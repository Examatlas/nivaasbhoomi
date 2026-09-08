import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { signSession } from "@/lib/auth/jwt";
import {
  DEALER_COOKIE,
  USER_COOKIE,
  SIGNUP_COOKIE,
  sessionCookieOptions,
  clearCookieOptions,
} from "@/lib/auth/cookie";
import { verifySignupToken } from "@/lib/auth/signup-token";
import { setSessionHint } from "@/lib/auth/session-hint-server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import {
  dealerRegistrationSchema,
  registerDealerForUser,
  createUserAndDealer,
} from "@/lib/dealers/register";

/**
 * POST /api/auth/dealer/complete-signup   (verified-phone token, NOT a session)
 *
 * The dealer self-signup submit (STEP 1). The caller holds a 15-minute
 * verified-phone cookie minted at OTP-verify — NOT a User session. Only here is
 * the User created (with the Dealer, atomically), so an abandoned form never
 * leaves an orphan User. On success: User + Dealer sessions set, signup cookie
 * cleared, browser sent to the dealer dashboard.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function setSessions(
  userId: string,
  dealerId: string,
  name: string | null | undefined,
  phone: string,
): Promise<void> {
  const store = await cookies();
  store.set(USER_COOKIE, await signSession({ role: "user", userId, dealerId }), sessionCookieOptions());
  store.set(DEALER_COOKIE, await signSession({ role: "dealer", dealerId }), sessionCookieOptions());
  store.set(SIGNUP_COOKIE, "", clearCookieOptions()); // burn the one-time signup token
  await setSessionHint({ name, phone, dealerId });
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const token = await verifySignupToken((await cookies()).get(SIGNUP_COOKIE)?.value);
  if (!token) {
    return fail("UNAUTHORIZED", "Your signup session expired. Please verify your number again.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = dealerRegistrationSchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const formName = parsed.data.name?.trim() || null;

  await connectDB();
  const existingUser = await User.findOne({ phone: token.phone });

  // Case A: a User already exists on this number (they logged in as a buyer once).
  if (existingUser) {
    // Honour an edited name (the form prefills the existing one, but it's editable).
    if (formName && formName !== existingUser.name) {
      existingUser.name = formName;
      await existingUser.save();
    }
    if (existingUser.dealerId) {
      // Already a dealer → just sign them in (idempotent double-submit).
      await setSessions(String(existingUser._id), String(existingUser.dealerId), existingUser.name, token.phone);
      return ok({ dealerId: String(existingUser.dealerId), next: "/dealer/dashboard", alreadyDealer: true });
    }
    const result = await registerDealerForUser(existingUser, parsed.data, ip);
    if (!result.ok) return fail(result.code, result.message, result.details);
    await setSessions(String(existingUser._id), result.dealerId, existingUser.name, token.phone);
    return ok({ dealerId: result.dealerId, next: "/dealer/dashboard", ...(result.linked ? { linked: true } : { created: true }) });
  }

  // Case B: brand-new number → create User + Dealer atomically (no orphan).
  const result = await createUserAndDealer(token.phone, formName, parsed.data, ip);
  if (!result.ok) return fail(result.code, result.message, result.details);
  await setSessions(result.userId, result.dealerId, formName, token.phone);
  return ok({ dealerId: result.dealerId, next: "/dealer/dashboard", created: true });
});
