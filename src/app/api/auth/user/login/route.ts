import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { verifyPassword, TIMING_DUMMY_HASH } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

/**
 * POST /api/auth/user/login   (buyer — email + password)
 *   body: { email, password }
 *
 * Verifies the password against the stored bcrypt hash and sets the buyer
 * session cookie. We always run bcrypt against SOME hash (dummy on a miss) so a
 * wrong email and a wrong password take the same time, and return one generic
 * message either way (no account-enumeration side channel). Per-IP throttle.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(200),
  password: z.string().min(1).max(200),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
function throttled(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (authMethod() !== "password") {
    return fail("FORBIDDEN", "Password login is disabled.");
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (throttled(ip)) {
    return fail("RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Email and password are required.");
  }

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email });
  const passwordOk = await verifyPassword(
    parsed.data.password,
    user?.passwordHash || TIMING_DUMMY_HASH,
  );

  if (!user || !user.passwordHash || !passwordOk) {
    return fail("UNAUTHORIZED", "Invalid email or password.");
  }

  user.lastLoginAt = new Date();
  await user.save();
  attempts.delete(ip);

  const token = await signSession({ role: "user", userId: String(user._id) });
  (await cookies()).set(USER_COOKIE, token, sessionCookieOptions());

  return ok({ role: "user", userId: String(user._id), name: user.name ?? null });
});
