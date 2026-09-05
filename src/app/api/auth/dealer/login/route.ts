import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod, dealerLoginEnabled } from "@/lib/config/flags";
import { verifyPassword, TIMING_DUMMY_HASH } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * POST /api/auth/dealer/login   (dealer — email + password)
 *   body: { email, password }
 *
 * Verifies the password against the stored bcrypt hash and sets the dealer
 * session cookie. Constant-time (dummy hash on a miss), one generic message,
 * per-IP throttle. A banned dealer is refused. Gated on dealer login enabled
 * AND AUTH_METHOD=password.
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
  if (!dealerLoginEnabled()) {
    return fail("FORBIDDEN", "Dealer sign-in is not available yet.");
  }
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
  const dealer = await Dealer.findOne({ email: parsed.data.email });
  const passwordOk = await verifyPassword(
    parsed.data.password,
    dealer?.passwordHash || TIMING_DUMMY_HASH,
  );

  if (!dealer || !dealer.passwordHash || !passwordOk) {
    return fail("UNAUTHORIZED", "Invalid email or password.");
  }
  if (dealer.status === "banned") {
    return fail("FORBIDDEN", "This account has been suspended.");
  }

  attempts.delete(ip);

  const token = await signSession({ role: "dealer", dealerId: String(dealer._id) });
  (await cookies()).set(DEALER_COOKIE, token, sessionCookieOptions());

  return ok({ role: "dealer", dealerId: String(dealer._id) });
});
