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
