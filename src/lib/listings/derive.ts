import { generateListingSlug, type ListingSlugParams } from "@/lib/utils/slug";

/**
 * Pure derived-value helpers for the Listing model (DEV-SPEC.txt Section 4).
 * Kept out of the schema so the exact hook logic can be unit-tested without a
 * database.
 */

/** 30 days in milliseconds - a listing expires 30 days after lastRefreshedAt. */
export const LISTING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * pricePerSqft for SALE listings: expectedPrice / area, where area is carpetArea
 * when present, otherwise builtUpArea (Section 4: "// auto"). Returns undefined
 * for rent, missing price, or missing/zero area so we never store a bogus 0 or
 * Infinity.
 */
export function computePricePerSqft(
  purpose: "sale" | "rent" | undefined,
  expectedPrice: number | undefined | null,
  carpetArea: number | undefined | null,
  builtUpArea: number | undefined | null,
): number | undefined {
  if (purpose !== "sale") return undefined;
  if (!expectedPrice || expectedPrice <= 0) return undefined;

  const area = carpetArea && carpetArea > 0 ? carpetArea : builtUpArea;
  if (!area || area <= 0) return undefined;

  return Math.round(expectedPrice / area);
}

/** expiresAt = lastRefreshedAt + 30 days. */
export function computeExpiresAt(lastRefreshedAt: Date): Date {
  return new Date(lastRefreshedAt.getTime() + LISTING_TTL_MS);
}

/**
 * Resolve the slug for a listing, guaranteeing it is generated exactly ONCE.
 * If a slug already exists it is returned unchanged - the URL never moves, even
 * when price or other fields change (Section 6: "Slug NEVER regenerate on edit
 * ... URL stable rehna chahiye SEO ke liye"). Only a listing with no slug yet
 * gets a freshly generated one.
 */
export function resolveListingSlug(
  existingSlug: string | undefined | null,
  params: ListingSlugParams,
): string {
  if (existingSlug && existingSlug.length > 0) return existingSlug;
  return generateListingSlug(params);
}
