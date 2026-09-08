import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FEATURED_CITIES } from "./featured-cities";

test("FEATURED_CITIES: pan-India list, valid lowercase slugs, includes Ranchi", () => {
  assert.equal(FEATURED_CITIES.length, 14);
  const slugs = FEATURED_CITIES.map((c) => c.slug);
  const names = FEATURED_CITIES.map((c) => c.name);
  assert.ok(slugs.includes("ranchi"));
  for (const c of FEATURED_CITIES) {
    assert.match(c.slug, /^[a-z-]+$/, `${c.name} slug should be lowercase kebab`);
    assert.ok(c.name.length > 0);
  }
  // No Jharkhand-only framing: the big metros are present (by display name;
  // their real DB slugs differ, e.g. Delhi → new-delhi, Bengaluru → bengaluru-urban).
  for (const n of ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata"]) {
    assert.ok(names.includes(n), `expected ${n}`);
  }
  assert.equal(new Set(slugs).size, slugs.length, "slugs unique");
});

test("seed-listings.sample.json: valid structure the importer accepts", () => {
  const raw = JSON.parse(readFileSync("src/data/seed-listings.sample.json", "utf8")) as {
    listings: { purpose: string; propertyType: string; price: number; city: string; locality: string; title: string }[];
  };
  assert.ok(Array.isArray(raw.listings) && raw.listings.length > 0);
  const TYPES = ["flat", "independent-house", "villa", "plot", "commercial-shop", "office", "pg", "warehouse"];
  for (const l of raw.listings) {
    assert.ok(["sale", "rent"].includes(l.purpose), `purpose ${l.purpose}`);
    assert.ok(TYPES.includes(l.propertyType), `type ${l.propertyType}`);
    assert.ok(typeof l.price === "number" && l.price > 0);
    assert.ok(l.city && l.locality && l.title);
  }
});
