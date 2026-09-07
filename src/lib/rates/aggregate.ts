import {
  RATE_IQR_FENCE,
  RATE_STALE_DAYS,
  RATE_STALE_POLICY,
  dataQualityFor,
  type DataQuality,
} from "@/lib/rates/config";

/**
 * Pure rate-aggregation math (no DB, no I/O) so the statistics are exhaustively
 * unit-tested. The cron job feeds it grouped listings and upserts the result.
 */

export type RatePropertyType = "flat" | "plot" | "house" | "commercial";
export type RatePurpose = "buy" | "rent";

/** Map a Listing.propertyType to one of the 4 rate buckets (null = skip). */
export function toRatePropertyType(listingType: string): RatePropertyType | null {
  switch (listingType) {
    case "flat":
    case "pg":
      return "flat";
    case "plot":
      return "plot";
    case "independent-house":
    case "villa":
      return "house";
    case "commercial-shop":
    case "office":
    case "warehouse":
      return "commercial";
    default:
      return null;
  }
}

/** Listing.purpose ("sale"/"rent") → rate purpose ("buy"/"rent"). */
export function toRatePurpose(listingPurpose: string): RatePurpose {
  return listingPurpose === "rent" ? "rent" : "buy";
}

/** Preferred usable area for a per-sqft figure (carpet > built-up > plot). */
export function pickArea(l: { carpetArea?: number | null; builtUpArea?: number | null; plotArea?: number | null }): number | null {
  const a = l.carpetArea || l.builtUpArea || l.plotArea || 0;
  return a > 0 ? a : null;
}

/** Linear-interpolated percentile of an ASCENDING-sorted array (q in [0,1]). */
export function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  return sortedAsc[lo]! + (sortedAsc[hi]! - sortedAsc[lo]!) * (pos - lo);
}

export function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

/**
 * Drop outliers with the Tukey IQR fence: keep [Q1 − k·IQR, Q3 + k·IQR]. A
 * single fat-finger entry (₹50 where ₹50,00,000 was meant) sits far below the
 * lower fence and is removed, so it can't wreck the median. Below 4 values IQR
 * isn't reliable, so nothing is dropped (those groups are "insufficient" anyway).
 */
export function removeOutliersIQR(values: number[], fence = RATE_IQR_FENCE): number[] {
  if (values.length < 4) return [...values];
  const s = [...values].sort((a, b) => a - b);
  const q1 = percentile(s, 0.25);
  const q3 = percentile(s, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - fence * iqr;
  const hi = q3 + fence * iqr;
  return s.filter((v) => v >= lo && v <= hi);
}

export interface RateListing {
  price: number; // expectedPrice (buy) or monthlyRent (rent)
  area?: number | null; // usable area in sqft, or null
  createdAt?: Date | null;
}

export interface GroupRate {
  sampleCount: number;
  medianTotalPrice: number | null;
  medianPricePerSqft: number | null;
  minPricePerSqft: number | null;
  maxPricePerSqft: number | null;
  p25PricePerSqft: number | null;
  p75PricePerSqft: number | null;
  dataQuality: DataQuality;
}

const round = (n: number) => Math.round(n);

/** Aggregate one (locality|city, propertyType, purpose) group. Deterministic —
 *  the same input always yields the same output (idempotent job). */
export function computeGroupRate(listings: RateListing[], now: Date = new Date()): GroupRate {
  // Stale handling (config): drop listings older than RATE_STALE_DAYS on "skip".
  const cutoff = now.getTime() - RATE_STALE_DAYS * 24 * 60 * 60 * 1000;
  const fresh =
    RATE_STALE_POLICY === "skip"
      ? listings.filter((l) => !l.createdAt || l.createdAt.getTime() >= cutoff)
      : listings;

  const priced = fresh.filter((l) => Number.isFinite(l.price) && l.price > 0);

  // Total price: clean outliers → sampleCount + median.
  const totalClean = removeOutliersIQR(priced.map((l) => l.price));
  const sampleCount = totalClean.length;
  const medianTotalPrice = sampleCount > 0 ? round(median(totalClean)) : null;

  // Price per sqft: only listings with an area.
  const perSqftRaw = priced
    .filter((l) => l.area && l.area > 0)
    .map((l) => l.price / (l.area as number));
  const psClean = removeOutliersIQR(perSqftRaw).sort((a, b) => a - b);

  const hasPs = psClean.length > 0;
  return {
    sampleCount,
    medianTotalPrice,
    medianPricePerSqft: hasPs ? round(median(psClean)) : null,
    minPricePerSqft: hasPs ? round(psClean[0]!) : null,
    maxPricePerSqft: hasPs ? round(psClean[psClean.length - 1]!) : null,
    p25PricePerSqft: hasPs ? round(percentile(psClean, 0.25)) : null,
    p75PricePerSqft: hasPs ? round(percentile(psClean, 0.75)) : null,
    dataQuality: dataQualityFor(sampleCount),
  };
}
