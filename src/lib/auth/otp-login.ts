import { randomInt } from "node:crypto";

/**
 * Pure login-OTP logic (no DB, no I/O) so the rules are exhaustively unit-tested.
 * The impure send/verify routes call these to make their decisions.
 */

/** Positive-integer env override with a fallback (empty / invalid → fallback). */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const OTP_TTL_SECONDS = 600; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // verify attempts before the code is burned

// Rate limits — env-configurable (defaults below). No hardcoded caps.
export const OTP_RATE_PER_PHONE = envInt("OTP_RATE_LIMIT_PHONE_PER_HOUR", 5); // sends/hour/phone
export const OTP_RATE_PER_IP = envInt("OTP_RATE_LIMIT_IP_PER_HOUR", 30); // sends/hour/IP
export const OTP_RATE_WINDOW_SECONDS = 3600; // 1 hour
/** Minimum gap between two OTP sends to the SAME phone (env-configurable). */
export const RESEND_COOLDOWN_SECONDS = envInt("OTP_RESEND_COOLDOWN_SECONDS", 30);

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

/** Why a send was blocked — for the SERVER log only; the user always sees a
 *  generic message (so phone-vs-IP can't be probed for enumeration). */
export type RateBlockReason = "phone_limit" | "ip_limit" | "cooldown";

export interface RateDecision {
  allowed: boolean;
  /** Seconds to wait before retrying (only when blocked). */
  retryAfter: number;
  reason?: RateBlockReason;
}

/** Block a send when the phone or IP has hit its hourly cap. Phone is checked
 *  first so the reason is deterministic when both are over. */
export function rateLimitDecision(
  phoneCount: number,
  ipCount: number,
  windowSeconds = OTP_RATE_WINDOW_SECONDS,
): RateDecision {
  if (phoneCount >= OTP_RATE_PER_PHONE) {
    return { allowed: false, retryAfter: windowSeconds, reason: "phone_limit" };
  }
  if (ipCount >= OTP_RATE_PER_IP) {
    return { allowed: false, retryAfter: windowSeconds, reason: "ip_limit" };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Enforce a minimum gap between two sends to one phone. `lastSentAt` is the
 *  time of that phone's most recent send (null = never sent). Returns the exact
 *  seconds left when still cooling down. */
export function cooldownDecision(
  lastSentAt: Date | null | undefined,
  now: Date = new Date(),
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
): RateDecision {
  if (!lastSentAt) return { allowed: true, retryAfter: 0 };
  const elapsed = (now.getTime() - lastSentAt.getTime()) / 1000;
  if (elapsed < cooldownSeconds) {
    return { allowed: false, retryAfter: Math.ceil(cooldownSeconds - elapsed), reason: "cooldown" };
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
