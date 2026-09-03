import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computePricePerSqft,
  computeExpiresAt,
  resolveListingSlug,
  LISTING_TTL_MS,
} from "@/lib/listings/derive";

test("pricePerSqft: sale uses carpetArea", () => {
  // 52,00,000 / 1250 = 4160
  assert.equal(computePricePerSqft("sale", 5_200_000, 1250, 1500), 4160);
});

test("pricePerSqft: falls back to builtUpArea when carpetArea absent", () => {
  assert.equal(computePricePerSqft("sale", 5_200_000, undefined, 1600), 3250);
  assert.equal(computePricePerSqft("sale", 5_200_000, 0, 1600), 3250);
});

test("pricePerSqft: rounds to the nearest rupee", () => {
  // 5,000,000 / 1300 = 3846.15... -> 3846
  assert.equal(computePricePerSqft("sale", 5_000_000, 1300, undefined), 3846);
});

test("pricePerSqft: undefined for rent, missing price, or missing/zero area", () => {
  assert.equal(computePricePerSqft("rent", 5_200_000, 1250, undefined), undefined);
  assert.equal(computePricePerSqft("sale", undefined, 1250, undefined), undefined);
  assert.equal(computePricePerSqft("sale", 5_200_000, 0, 0), undefined);
  assert.equal(computePricePerSqft("sale", 5_200_000, undefined, undefined), undefined);
});

test("expiresAt is exactly 30 days after lastRefreshedAt", () => {
  const from = new Date("2026-09-04T10:00:00.000Z");
  const expires = computeExpiresAt(from);
  assert.equal(expires.getTime() - from.getTime(), LISTING_TTL_MS);
  assert.equal(expires.toISOString(), "2026-10-04T10:00:00.000Z");
  assert.equal(LISTING_TTL_MS, 30 * 24 * 60 * 60 * 1000);
});

const slugParams = (price: number) => ({
  bhk: "3",
  propertyType: "flat",
  localitySlug: "kanke-road",
  citySlug: "ranchi",
  purpose: "sale" as const,
  price,
});

test("slug is generated when none exists", () => {
  const slug = resolveListingSlug(undefined, slugParams(5_200_000));
  assert.match(slug, /^3-bhk-flat-kanke-road-ranchi-52-lakh-[0-9a-z]{6}$/);
  assert.equal(resolveListingSlug("", slugParams(5_200_000)).length > 0, true);
});

test("slug NEVER regenerates once set - even when the price changes", () => {
  const original = "3-bhk-flat-kanke-road-ranchi-52-lakh-a7x9k2";
  // Price changed to 60 lakh, but the existing slug must be returned unchanged.
  const after = resolveListingSlug(original, slugParams(6_000_000));
  assert.equal(after, original);
  // And unrelated param changes also never move it.
  assert.equal(
    resolveListingSlug(original, {
      bhk: "4",
      propertyType: "villa",
      localitySlug: "ashok-nagar",
      citySlug: "ranchi",
      purpose: "rent",
      price: 25_000,
    }),
    original,
  );
});
