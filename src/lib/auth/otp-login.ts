import { randomInt } from "node:crypto";

/**
 * Pure login-OTP logic (no DB, no I/O) so the rules are exhaustively unit-tested.
 * The impure send/verify routes call these to make their decisions.
 */

export const OTP_TTL_SECONDS = 600; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // verify attempts before the code is burned
export const OTP_RATE_PER_PHONE = 3; // sends per hour per phone
export const OTP_RATE_PER_IP = 10; // sends per hour per IP
export const OTP_RATE_WINDOW_SECONDS = 3600; // 1 hour
export const RESEND_COOLDOWN_SECONDS = 30;

export type OtpRole = "buyer" | "dealer";

/** Normalize an Indian mobile to canonical "91XXXXXXXXXX" (E.164 digits, no +),
 *  or null if it isn't a valid 10-digit Indian mobile. Handles +91 / 0 / spaces. */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  let core = digits;
  if (core.length === 13 && core.startsWith("091")) core = core.slice(3);
  else if (core.length === 12 && core.startsWith("91")) core = core.slice(2);
  else if (core.length === 11 && core.startsWith("0")) core = core.slice(1);
  if (core.length !== 10 || !/^[6-9]\d{9}$/.test(core)) return null;
  return `91${core}`;
}

/** Display form "+91XXXXXXXXXX" from the canonical "91XXXXXXXXXX". */
export function toDisplayPhone(canonical: string): string {
  return `+${canonical}`;
}

/** Cryptographically-random 6-digit code (000000-999999). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface RateDecision {
  allowed: boolean;
  /** Seconds to wait before retrying (only when blocked). */
  retryAfter: number;
}

/** Block a send when the phone or IP has hit its hourly cap. */
export function rateLimitDecision(phoneCount: number, ipCount: number): RateDecision {
  if (phoneCount >= OTP_RATE_PER_PHONE || ipCount >= OTP_RATE_PER_IP) {
    return { allowed: false, retryAfter: OTP_RATE_WINDOW_SECONDS };
  }
  return { allowed: true, retryAfter: 0 };
}

/** After this many failed attempts the code is burned (delete + 429). */
export function isLockedOut(attempts: number): boolean {
  return attempts >= OTP_MAX_ATTEMPTS;
}

/** A code older than the TTL is invalid even if its TTL sweep hasn't run yet. */
export function isExpired(createdAt: Date, now: Date, ttlSeconds = OTP_TTL_SECONDS): boolean {
  return now.getTime() - createdAt.getTime() > ttlSeconds * 1000;
}

export type VerifyOutcome = "ok-dealer" | "ok-user" | "create-user" | "register-dealer";

/** What to do once the code matches: an existing dealer signs straight in; a
 *  verified number with NO dealer is sent to self-registration (a User is
 *  found/created first, then the dealer registration form). Buyers are
 *  auto-created on first login. */
export function decideVerify(role: OtpRole, accountFound: boolean): VerifyOutcome {
  if (role === "dealer") return accountFound ? "ok-dealer" : "register-dealer";
  return accountFound ? "ok-user" : "create-user";
}
