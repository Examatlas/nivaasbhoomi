import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { verifyPassword, TIMING_DUMMY_HASH } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { STAFF_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { Staff } from "@/lib/db/models/Staff";

/**
 * POST /api/auth/staff/login   (staff — email + password)
 *
 * Mirrors dealer login: constant-time verify (dummy hash on a miss), one generic
 * message, per-IP throttle. The signed token carries the account's current
 * tokenVersion (`tv`) so a later deactivation invalidates it. An inactive staff
 * is refused.
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
  const staff = await Staff.findOne({ email: parsed.data.email });
  const passwordOk = await verifyPassword(
    parsed.data.password,
    staff?.passwordHash || TIMING_DUMMY_HASH,
  );

  if (!staff || !passwordOk) {
    return fail("UNAUTHORIZED", "Invalid email or password.");
  }
  if (staff.status !== "active") {
    return fail("FORBIDDEN", "This account has been deactivated.");
  }

  attempts.delete(ip);
  staff.lastLoginAt = new Date();
  await staff.save();

  const token = await signSession({
    role: "staff",
    staffId: String(staff._id),
    tv: staff.tokenVersion ?? 0,
  });
  (await cookies()).set(STAFF_COOKIE, token, sessionCookieOptions());

  return ok({ role: "staff", staffId: String(staff._id), name: staff.name });
});
