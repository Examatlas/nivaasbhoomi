import { test } from "node:test";
import assert from "node:assert/strict";

import {
  slugify,
  generateCitySlug,
  generateLocalitySlug,
  humanizePriceForSlug,
  humanizeRentForSlug,
  generateListingSlug,
} from "@/lib/utils/slug";
import { classifyCityTier } from "@/scripts/city-classification";

/**
 * Reproduce the seed's city-slug assignment exactly: sort by (tier asc, state
 * asc, name asc) so the highest-priority city is processed first and keeps the
 * plain slug, then feed each through generateCitySlug against a growing
 * used-slug set. This is the behaviour the collision cases must verify.
 */
interface CityInput {
  name: string;
  state: string;
}

function assignCitySlugs(cities: CityInput[]): Map<string, string> {
  const withTier = cities.map((c) => ({ ...c, tier: classifyCityTier(c.name, c.state) }));
  withTier.sort(
    (a, b) =>
      a.tier - b.tier || a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
  );

  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const c of withTier) {
    const slug = generateCitySlug(c.name, c.state, (s) => used.has(s));
    used.add(slug);
    result.set(`${c.name}::${c.state}`, slug);
  }
  return result;
}

// ---------------------------------------------------------------- slugify ----

test("slugify: lowercase, hyphenated, ASCII", () => {
  assert.equal(slugify("New Delhi"), "new-delhi");
  assert.equal(slugify("Bengaluru"), "bengaluru");
  assert.equal(slugify("Thane (Navi Mumbai)"), "thane-navi-mumbai");
});

test("slugify: Indian name punctuation - dots and apostrophes drop, no double hyphens", () => {
  assert.equal(slugify("K.R. Puram"), "kr-puram");
  assert.equal(slugify("St. Thomas Mount"), "st-thomas-mount");
  assert.equal(slugify("  Kanke   Road  "), "kanke-road");
  assert.equal(slugify("Nagar / Colony"), "nagar-colony");
});

test("slugify: strips diacritics from transliterations", () => {
  assert.equal(slugify("Puḍucēri"), "puduceri");
});

// -------------------------------------------------- city slug collisions ----

test("collision: Aurangabad - higher-tier (Maharashtra) keeps the plain slug", () => {
  // Maharashtra's Aurangabad is million-plus (tier 2); Bihar's is tier 3.
  assert.equal(classifyCityTier("Aurangabad", "Maharashtra"), 2);
  assert.equal(classifyCityTier("Aurangabad", "Bihar"), 3);

  const slugs = assignCitySlugs([
    { name: "Aurangabad", state: "Bihar" },
    { name: "Aurangabad", state: "Maharashtra" },
  ]);

  assert.equal(slugs.get("Aurangabad::Maharashtra"), "aurangabad");
  assert.equal(slugs.get("Aurangabad::Bihar"), "aurangabad-bihar");
});

test("collision: Aurangabad - tier priority beats input order (Bihar listed first)", () => {
  // Even though "Bihar" sorts before "Maharashtra", the tier-2 city must win.
  const slugs = assignCitySlugs([
    { name: "Aurangabad", state: "Bihar" },
    { name: "Aurangabad", state: "Maharashtra" },
  ]);
  assert.equal(slugs.get("Aurangabad::Maharashtra"), "aurangabad");
});

test("collision: Bilaspur (Chhattisgarh & Himachal Pradesh) - same tier, deterministic winner", () => {
  // Neither is million-plus/capital -> both tier 3 -> decided by state order.
  assert.equal(classifyCityTier("Bilaspur", "Chhattisgarh"), 3);
  assert.equal(classifyCityTier("Bilaspur", "Himachal Pradesh"), 3);

  const slugs = assignCitySlugs([
    { name: "Bilaspur", state: "Himachal Pradesh" },
    { name: "Bilaspur", state: "Chhattisgarh" },
  ]);

  // "Chhattisgarh" < "Himachal Pradesh", so it keeps the plain slug.
  assert.equal(slugs.get("Bilaspur::Chhattisgarh"), "bilaspur");
  assert.equal(slugs.get("Bilaspur::Himachal Pradesh"), "bilaspur-himachal-pradesh");
});

test("collision: Pratapgarh (Uttar Pradesh & Rajasthan) - both tier 3", () => {
  const slugs = assignCitySlugs([
    { name: "Pratapgarh", state: "Uttar Pradesh" },
    { name: "Pratapgarh", state: "Rajasthan" },
  ]);

  // "Rajasthan" < "Uttar Pradesh" -> Rajasthan keeps the plain slug.
  assert.equal(slugs.get("Pratapgarh::Rajasthan"), "pratapgarh");
  assert.equal(slugs.get("Pratapgarh::Uttar Pradesh"), "pratapgarh-uttar-pradesh");

  // Every city still ends with a unique slug.
  assert.equal(new Set(slugs.values()).size, 2);
});

test("no collision: Hazaribagh (Jharkhand only) keeps the plain slug", () => {
  const slugs = assignCitySlugs([{ name: "Hazaribagh", state: "Jharkhand" }]);
  assert.equal(slugs.get("Hazaribagh::Jharkhand"), "hazaribagh");
});

test("collision: three-way same name all resolve uniquely", () => {
  const slugs = assignCitySlugs([
    { name: "Pratapgarh", state: "Uttar Pradesh" },
    { name: "Pratapgarh", state: "Rajasthan" },
    { name: "Pratapgarh", state: "Tripura" },
  ]);
  assert.equal(new Set(slugs.values()).size, 3);
  assert.equal(slugs.get("Pratapgarh::Rajasthan"), "pratapgarh");
});

// ------------------------------------------------ locality slug (in city) ----

test("locality slug: unique within a city, duplicates get a numeric suffix", () => {
  const used = new Set<string>();
  const a = generateLocalitySlug("Kanke Road", (s) => used.has(s));
  used.add(a);
  const b = generateLocalitySlug("Kanke Road", (s) => used.has(s)); // same name, same city
  used.add(b);

  assert.equal(a, "kanke-road");
  assert.equal(b, "kanke-road-2");
});

test("locality slug: same slug allowed across different cities (independent sets)", () => {
  const ranchi = new Set<string>();
  const patna = new Set<string>();
  const inRanchi = generateLocalitySlug("Kanke Road", (s) => ranchi.has(s));
  const inPatna = generateLocalitySlug("Kanke Road", (s) => patna.has(s));
  assert.equal(inRanchi, "kanke-road");
  assert.equal(inPatna, "kanke-road"); // no cross-city collision
});

// ---------------------------------------------------- price humanization ----

test("price humanization matches the spec examples", () => {
  assert.equal(humanizePriceForSlug(5_200_000), "52-lakh");
  assert.equal(humanizePriceForSlug(12_500_000), "1-25-crore");
  assert.equal(humanizePriceForSlug(8_500_000), "85-lakh");
  assert.equal(humanizePriceForSlug(1_00_00_000), "1-crore");
  assert.equal(humanizePriceForSlug(95_000), "95000");
});

test("rent humanization matches the spec examples", () => {
  assert.equal(humanizeRentForSlug(25_000), "25k-rent");
  assert.equal(humanizeRentForSlug(8_500), "8-5k-rent");
});

test("listing slug: shape and stability", () => {
  const slug = generateListingSlug({
    bhk: "3",
    propertyType: "flat",
    localitySlug: "kanke-road",
    citySlug: "ranchi",
    purpose: "sale",
    price: 5_200_000,
  });
  assert.match(slug, /^3-bhk-flat-kanke-road-ranchi-52-lakh-[0-9a-z]{6}$/);

  const plot = generateListingSlug({
    propertyType: "plot",
    localitySlug: "hinoo",
    citySlug: "ranchi",
    purpose: "sale",
    price: 3_800_000,
  });
  assert.match(plot, /^plot-hinoo-ranchi-38-lakh-[0-9a-z]{6}$/);
});
