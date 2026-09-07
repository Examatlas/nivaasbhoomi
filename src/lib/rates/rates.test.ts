import { test } from "node:test";
import assert from "node:assert/strict";

import {
  percentile, median, removeOutliersIQR, computeGroupRate,
  toRatePropertyType, toRatePurpose, pickArea, type RateListing,
} from "./aggregate";
import { dataQualityFor, RATE_SUFFICIENT_MIN, RATE_LOW_MIN } from "./config";

test("percentile + median: interpolated", () => {
  const s = [10, 20, 30, 40];
  assert.equal(median(s), 25);
  assert.equal(percentile(s, 0.25), 17.5);
  assert.equal(percentile(s, 0.75), 32.5);
  assert.equal(percentile([5], 0.5), 5);
});

test("dataQuality thresholds: <4 insufficient, 4-7 low, 8+ sufficient", () => {
  assert.equal(RATE_SUFFICIENT_MIN, 8);
  assert.equal(RATE_LOW_MIN, 4);
  assert.equal(dataQualityFor(3), "insufficient");
  assert.equal(dataQualityFor(4), "low");
  assert.equal(dataQualityFor(7), "low");
  assert.equal(dataQualityFor(8), "sufficient");
});

test("removeOutliersIQR: a fat-finger price is dropped", () => {
  // ~₹50L cluster + one ₹50 (fat finger) + one absurd high.
  const vals = [4_800_000, 5_000_000, 5_100_000, 5_200_000, 5_050_000, 4_950_000, 50, 500_000_000];
  const clean = removeOutliersIQR(vals);
  assert.ok(!clean.includes(50), "50 should be removed");
  assert.ok(!clean.includes(500_000_000), "absurd high should be removed");
  assert.ok(clean.length === 6);
});

// ---- full group aggregate ----
function mk(price: number, area: number | null, ageDays = 1): RateListing {
  return { price, area, createdAt: new Date(Date.now() - ageDays * 86_400_000) };
}

test("computeGroupRate: median/p25/p75 correct; outlier doesn't skew it", () => {
  // 8 flats ~₹5,000/sqft, plus one fat-finger ₹50 total.
  const items: RateListing[] = [
    mk(5_000_000, 1000), mk(5_100_000, 1000), mk(4_900_000, 1000), mk(5_050_000, 1000),
    mk(4_950_000, 1000), mk(5_200_000, 1000), mk(4_800_000, 1000), mk(5_150_000, 1000),
    mk(50, 1000), // fat finger
  ];
  const r = computeGroupRate(items);
  // Outlier removed → sampleCount 8 → sufficient.
  assert.equal(r.sampleCount, 8);
  assert.equal(r.dataQuality, "sufficient");
  // per-sqft ~ price/1000, median around 5025.
  assert.ok(r.medianPricePerSqft! > 4800 && r.medianPricePerSqft! < 5200);
  assert.ok(r.p25PricePerSqft! <= r.medianPricePerSqft!);
  assert.ok(r.p75PricePerSqft! >= r.medianPricePerSqft!);
  assert.ok(r.medianTotalPrice! > 4_800_000 && r.medianTotalPrice! < 5_200_000);
});

test("computeGroupRate: 3 listings → insufficient, NO leaked numbers path (caller withholds)", () => {
  const r = computeGroupRate([mk(5_000_000, 1000), mk(5_100_000, 1000), mk(4_900_000, 1000)]);
  assert.equal(r.sampleCount, 3);
  assert.equal(r.dataQuality, "insufficient");
});

test("computeGroupRate: area-less listings count for total but not per-sqft", () => {
  const items = [
    mk(5_000_000, null), mk(5_100_000, null), mk(4_900_000, null), mk(5_050_000, null),
  ];
  const r = computeGroupRate(items);
  assert.equal(r.sampleCount, 4);
  assert.equal(r.dataQuality, "low");
  assert.equal(r.medianPricePerSqft, null); // no area → no per-sqft
  assert.ok(r.medianTotalPrice! > 0);
});

test("computeGroupRate: idempotent (same input → same output)", () => {
  const items = [mk(5_000_000, 1000), mk(5_100_000, 1010), mk(4_900_000, 990), mk(5_050_000, 1005), mk(4_950_000, 995)];
  const now = new Date("2026-06-01T00:00:00Z");
  assert.deepEqual(computeGroupRate(items, now), computeGroupRate(items, now));
});

test("mapping helpers", () => {
  assert.equal(toRatePropertyType("flat"), "flat");
  assert.equal(toRatePropertyType("villa"), "house");
  assert.equal(toRatePropertyType("independent-house"), "house");
  assert.equal(toRatePropertyType("commercial-shop"), "commercial");
  assert.equal(toRatePropertyType("plot"), "plot");
  assert.equal(toRatePurpose("sale"), "buy");
  assert.equal(toRatePurpose("rent"), "rent");
  assert.equal(pickArea({ carpetArea: 900, builtUpArea: 1000 }), 900);
  assert.equal(pickArea({ plotArea: 1200 }), 1200);
  assert.equal(pickArea({}), null);
});
