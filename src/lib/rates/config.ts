/**
 * Locality/city rate-aggregation config (Phase 4A). All thresholds live here so
 * they can be tuned without touching the aggregation logic.
 */

/** sampleCount >= this → "sufficient" (safe to show publicly in P4B). */
export const RATE_SUFFICIENT_MIN = 8;
/** sampleCount in [RATE_LOW_MIN, RATE_SUFFICIENT_MIN) → "low" (show with warning). */
export const RATE_LOW_MIN = 4;
/** Below RATE_LOW_MIN → "insufficient" (NEVER show publicly). */

export type DataQuality = "sufficient" | "low" | "insufficient";

export function dataQualityFor(sampleCount: number): DataQuality {
  if (sampleCount >= RATE_SUFFICIENT_MIN) return "sufficient";
  if (sampleCount >= RATE_LOW_MIN) return "low";
  return "insufficient";
}

/** Listings older than this many days are handled per RATE_STALE_POLICY. */
export const RATE_STALE_DAYS = 90;
/** "skip" drops stale listings from the aggregate (chosen: keeps medians clean
 *  and avoids weighted-median complexity). Switch to "keep" to include them. */
export const RATE_STALE_POLICY: "skip" | "keep" = "skip";

/** IQR fence multiplier for outlier removal (1.5 = classic Tukey fence). */
export const RATE_IQR_FENCE = 1.5;

/** P4B (public rate pages) readiness target: this many "sufficient" localities. */
export const P4B_READINESS_MIN_LOCALITIES = 25;
