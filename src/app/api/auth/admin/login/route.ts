import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { verifyPassword, TIMING_DUMMY_HASH } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";

/**
 * POST /api/auth/admin/login   (DEV-SPEC.txt Sections 7-8)
 *   body: { email, password }
 *
 * The single admin is configured via env (ADMIN_EMAIL, ADMIN_PASSWORD_HASH).
 * On success, signs a 30-day JWT and sets it in an httpOnly, secure,
 * sameSite=lax cookie.
 *
 * Timing: we always run bcrypt.compare against SOME hash so a wrong email and a
 * wrong password take the same time (no email-enumeration side channel), and we
 * return one generic message for either.
 */
const bodySchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

// Best-effort in-memory brute-force throttle (per IP). A real deployment should
// back this with Redis (Section 16); this protects a single instance.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
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

function clearAttempts(ip: string) {
  attempts.delete(ip);
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

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminHash) {
    return fail("SERVER_ERROR", "Admin login is not configured on the server.");
  }

  const emailMatches = parsed.data.email.trim().toLowerCase() === adminEmail;
  const passwordOk = await verifyPassword(
    parsed.data.password,
    emailMatches ? adminHash : TIMING_DUMMY_HASH,
  );

  if (!emailMatches || !passwordOk) {
    return fail("UNAUTHORIZED", "Invalid email or password.");
  }

  clearAttempts(ip);

  const token = await signSession({ role: "admin", adminId: adminEmail });
  (await cookies()).set(ADMIN_COOKIE, token, sessionCookieOptions());

  return ok({ email: adminEmail, role: "admin" });
});
