import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/jwt";

/**
 * Session cookie names and options (DEV-SPEC.txt Section 8: httpOnly, secure,
 * sameSite lax, 30 days). Admin and dealer sessions use separate cookies so one
 * role's session can never be read as the other.
 */
export const ADMIN_COOKIE = "nb_admin_session";
export const DEALER_COOKIE = "nb_dealer_session";
/** Buyer (WhatsApp-OTP) session - separate cookie from admin/dealer. */
export const USER_COOKIE = "nb_user_session";
/** Short-lived dealer-signup token (verified phone, 15 min) — carries a verified
 *  phone from OTP-verify to the registration form so NO User is created until
 *  the form is actually submitted (STEP 1: orphan-User fix). */
export const SIGNUP_COOKIE = "nb_dealer_signup";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Options for clearing a session cookie (maxAge 0). */
export function clearCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}

/** Short-lived (15 min) httpOnly options for the dealer-signup token cookie. */
export function signupCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 15 * 60 };
}
