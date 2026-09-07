/**
 * Pure dealer self-signup rules (no DB, no I/O) so the anti-spam decisions are
 * exhaustively unit-tested. The impure upgrade route calls these.
 */

export const SIGNUP_RATE_PER_IP = 3; // dealer signups per hour per IP
export const SIGNUP_RATE_WINDOW_SECONDS = 3600; // 1 hour

export interface SignupRateDecision {
  allowed: boolean;
  /** Seconds to wait before retrying (only when blocked). */
  retryAfter: number;
}

/** Block a signup once this IP has created SIGNUP_RATE_PER_IP dealers this hour. */
export function signupRateLimitDecision(ipCount: number): SignupRateDecision {
  if (ipCount >= SIGNUP_RATE_PER_IP) {
    return { allowed: false, retryAfter: SIGNUP_RATE_WINDOW_SECONDS };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Canonical business name for duplicate comparison: trimmed, lower-cased,
 *  internal whitespace collapsed. */
export function normalizeBusinessName(name: string): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DealerLike {
  businessName: string;
  cities: string[];
}

/**
 * A signup is a DUPLICATE (flag, don't block) when an existing dealer shares the
 * SAME normalized business name AND at least one overlapping coverage city.
 */
export function isDuplicateSignup(candidate: DealerLike, existing: DealerLike[]): boolean {
  const name = normalizeBusinessName(candidate.businessName);
  if (!name) return false;
  const cities = new Set(candidate.cities.map(String));
  return existing.some(
    (e) =>
      normalizeBusinessName(e.businessName) === name &&
      e.cities.some((c) => cities.has(String(c))),
  );
}
