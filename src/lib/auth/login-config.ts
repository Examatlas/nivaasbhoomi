/**
 * Which sign-in methods each role offers — the single source of truth the login
 * pages render from, so "buyer has no password field" is a testable fact, not a
 * UI accident.
 *
 *   buyer  — WhatsApp OTP only (no password).
 *   dealer — WhatsApp OTP primary, email+password as a permanent fallback.
 *   admin  — email+password only (never OTP).
 */
export type AuthRole = "buyer" | "dealer" | "admin";

export interface LoginMethods {
  otp: boolean;
  password: boolean;
}

export function loginMethods(role: AuthRole): LoginMethods {
  switch (role) {
    case "buyer":
      return { otp: true, password: false };
    case "dealer":
      return { otp: true, password: true };
    case "admin":
      return { otp: false, password: true };
  }
}
