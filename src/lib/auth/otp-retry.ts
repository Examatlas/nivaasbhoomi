/**
 * Client-safe (no node/DB imports) formatter for a rate-limit retry-after value,
 * so the OTP form can show a concrete "try again in N" instead of a generic
 * error. Kept out of otp-login.ts because that module imports node:crypto and
 * can't be bundled into a client component.
 */
export function formatRetryAfter(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `Please try again in ${s} second${s === 1 ? "" : "s"}.`;
  const m = Math.ceil(s / 60);
  return `Please try again in ${m} minute${m === 1 ? "" : "s"}.`;
}
