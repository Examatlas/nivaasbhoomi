import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFilterSegment } from "@/lib/filters/parse";
import { describeFilter } from "@/lib/filters/describe";

/** Assert a segment matches and yields exactly the expected filter. */
function expectMatch(segment: string, filter: Record<string, unknown>) {
  const r = parseFilterSegment(segment);
  assert.equal(r.matched, true, `expected "${segment}" to match`);
  if (r.matched) assert.deepEqual(r.filter, filter);
}

function expectNoMatch(segment: string) {
  assert.equal(
    parseFilterSegment(segment).matched,
    false,
    `expected "${segment}" NOT to match`,
  );
}

// ---- every supported Section 9 pattern ----

test("propertyType alone", () => {
  expectMatch("flats", { propertyType: "flat" });
  expectMatch("plots", { propertyType: "plot" });
  expectMatch("villas", { propertyType: "villa" });
  expectMatch("independent-houses", { propertyType: "independent-house" });
  expectMatch("commercial-shops", { propertyType: "commercial-shop" });
  expectMatch("offices", { propertyType: "office" });
  expectMatch("pgs", { propertyType: "pg" });
  expectMatch("warehouses", { propertyType: "warehouse" });
});

test("bhk + propertyType", () => {
  expectMatch("3-bhk-flats", { propertyType: "flat", bhk: "3" });
  expectMatch("1-rk-flats", { propertyType: "flat", bhk: "1rk" });
  expectMatch("2-bhk-villas", { propertyType: "villa", bhk: "2" });
  expectMatch("5-plus-bhk-flats", { propertyType: "flat", bhk: "5plus" });
  expectMatch("5-bhk-flats", { propertyType: "flat", bhk: "5plus" });
});

test("propertyType + purpose", () => {
  expectMatch("flats-for-rent", { propertyType: "flat", purpose: "rent" });
  expectMatch("plots-for-sale", { propertyType: "plot", purpose: "sale" });
});

test("bhk + propertyType + purpose", () => {
  expectMatch("3-bhk-flats-for-rent", {
    propertyType: "flat",
    bhk: "3",
    purpose: "rent",
  });
  expectMatch("1-rk-flats-for-rent", {
    propertyType: "flat",
    bhk: "1rk",
    purpose: "rent",
  });
});

test("propertyType + budget (lakh & crore, decimals)", () => {
  expectMatch("flats-under-50-lakh", { propertyType: "flat", maxPrice: 5_000_000 });
  expectMatch("plots-under-1-crore", { propertyType: "plot", maxPrice: 10_000_000 });
  expectMatch("flats-under-1-5-crore", { propertyType: "flat", maxPrice: 15_000_000 });
  expectMatch("villas-under-75-lakh", { propertyType: "villa", maxPrice: 7_500_000 });
});

test("furnishing + propertyType + purpose", () => {
  expectMatch("furnished-flats-for-rent", {
    propertyType: "flat",
    furnishing: "furnished",
    purpose: "rent",
  });
  expectMatch("semi-furnished-flats-for-rent", {
    propertyType: "flat",
    furnishing: "semi-furnished",
    purpose: "rent",
  });
  expectMatch("unfurnished-flats-for-sale", {
    propertyType: "flat",
    furnishing: "unfurnished",
    purpose: "sale",
  });
});

// ---- unsupported / malformed segments must NOT match (-> notFound) ----

test("unsupported and malformed segments return no-match", () => {
  expectNoMatch(""); // empty
  expectNoMatch("random-junk"); // gibberish
  expectNoMatch("flat"); // singular, not the plural URL form
  expectNoMatch("flats-for-lease"); // unknown purpose
  expectNoMatch("furnished-flats"); // furnishing+type WITHOUT purpose (not a listed pattern)
  expectNoMatch("6-bhk-flats"); // bhk out of range
  expectNoMatch("3-bhk"); // bhk without a property type
  expectNoMatch("flats-under-50"); // budget missing unit
  expectNoMatch("flats-under-lakh"); // budget missing number
  expectNoMatch("flats-under-50-thousand"); // unsupported unit
  expectNoMatch("flats-for-rent-under-50-lakh"); // combo not in Section 9
  expectNoMatch("cheap-flats"); // unknown adjective
  expectNoMatch("flats/for-rent"); // slash injection
});

test("matching is case-insensitive", () => {
  expectMatch("FLATS", { propertyType: "flat" });
  expectMatch("3-BHK-Flats-For-Rent", {
    propertyType: "flat",
    bhk: "3",
    purpose: "rent",
  });
});

// ---- describeFilter labels ----

test("describeFilter produces readable labels", () => {
  const cases: [string, string][] = [
    ["flats", "Flats"],
    ["3-bhk-flats", "3 BHK Flats"],
    ["flats-for-rent", "Flats for Rent"],
    ["3-bhk-flats-for-rent", "3 BHK Flats for Rent"],
    ["furnished-flats-for-rent", "Furnished Flats for Rent"],
    ["flats-under-50-lakh", "Flats under ₹50 Lakh"],
    ["1-rk-flats", "1 RK Flats"],
  ];
  for (const [segment, expected] of cases) {
    const r = parseFilterSegment(segment);
    assert.equal(r.matched, true);
    if (r.matched) assert.equal(describeFilter(r.filter), expected);
  }
});
