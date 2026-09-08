/**
 * Dealer monthly lead quota (STEP 3.1).
 *
 * Every dealer gets the same monthly quota, resettable on the 1st of the month.
 * The default is 30, overridable with DEALER_MONTHLY_QUOTA (so it can be tuned
 * without a code change). Kept dependency-free so it's safe to import anywhere.
 */
export const DEFAULT_MONTHLY_QUOTA: number = (() => {
  const raw = Number(process.env.DEALER_MONTHLY_QUOTA);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
})();
