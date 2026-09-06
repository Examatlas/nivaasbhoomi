import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateDealerSlug,
  generateDealerSlug,
  normalizeDealerSlug,
  RESERVED_DEALER_SLUGS,
} from "@/lib/dealers/slug";

// ---- validation ----

test("slug validation: accepts a normal slug", () => {
  assert.deepEqual(validateDealerSlug("sharma-properties-lalpur"), { ok: true });
});

test("slug validation: length bounds", () => {
  assert.equal(validateDealerSlug("ab").ok, false); // < 3
  assert.equal(validateDealerSlug("a".repeat(61)).ok, false); // > 60
  assert.equal(validateDealerSlug("abc").ok, true);
});

test("slug validation: charset + hyphen rules", () => {
  assert.equal(validateDealerSlug("Sharma").ok, false); // uppercase
  assert.equal(validateDealerSlug("sharma properties").ok, false); // space
  assert.equal(validateDealerSlug("-sharma").ok, false); // leading hyphen
  assert.equal(validateDealerSlug("sharma-").ok, false); // trailing hyphen
  assert.equal(validateDealerSlug("sharma--properties").ok, false); // double hyphen
  assert.equal(validateDealerSlug("sharma_properties").ok, false); // underscore
  assert.equal(validateDealerSlug("sharma-properties-2").ok, true);
});

test("slug validation: rejects every reserved word", () => {
  for (const w of RESERVED_DEALER_SLUGS) {
    assert.equal(validateDealerSlug(w).ok, false, `reserved "${w}" should be rejected`);
  }
});

// ---- normalization ----

test("normalize: lowercase, ascii, hyphen, 60-char cap", () => {
  assert.equal(normalizeDealerSlug("Sharma Properties & Co."), "sharma-properties-co");
  const long = normalizeDealerSlug("a".repeat(80));
  assert.ok(long.length <= 60);
  assert.ok(!long.endsWith("-"));
});

// ---- generation (candidate priority + numeric tail) ----

test("generate: level 1 (business + locality) when free", () => {
  const s = generateDealerSlug({
    businessName: "Sharma Properties",
    localityName: "Lalpur",
    cityName: "Ranchi",
    isTaken: () => false,
  });
  assert.equal(s, "sharma-properties-lalpur");
});

test("generate: falls to level 2 (business + city) when level 1 taken", () => {
  const taken = new Set(["sharma-properties-lalpur"]);
  const s = generateDealerSlug({
    businessName: "Sharma Properties",
    localityName: "Lalpur",
    cityName: "Ranchi",
    isTaken: (x) => taken.has(x),
  });
  assert.equal(s, "sharma-properties-ranchi");
});

test("generate: falls to level 3 (business + locality + city)", () => {
  const taken = new Set(["sharma-properties-lalpur", "sharma-properties-ranchi"]);
  const s = generateDealerSlug({
    businessName: "Sharma Properties",
    localityName: "Lalpur",
    cityName: "Ranchi",
    isTaken: (x) => taken.has(x),
  });
  assert.equal(s, "sharma-properties-lalpur-ranchi");
});

test("generate: numeric suffix when all three collide", () => {
  const taken = new Set([
    "sharma-properties-lalpur",
    "sharma-properties-ranchi",
    "sharma-properties-lalpur-ranchi",
    "sharma-properties-lalpur-ranchi-2",
  ]);
  const s = generateDealerSlug({
    businessName: "Sharma Properties",
    localityName: "Lalpur",
    cityName: "Ranchi",
    isTaken: (x) => taken.has(x),
  });
  assert.equal(s, "sharma-properties-lalpur-ranchi-3");
});

test("generate: no coverage -> business name only, then numeric", () => {
  assert.equal(
    generateDealerSlug({ businessName: "Sharma Properties", isTaken: () => false }),
    "sharma-properties",
  );
  const taken = new Set(["sharma-properties"]);
  assert.equal(
    generateDealerSlug({ businessName: "Sharma Properties", isTaken: (x) => taken.has(x) }),
    "sharma-properties-2",
  );
});

test("generate: treats reserved words as taken", () => {
  // "profile" is reserved; a one-word business name that slugs to it must not be used bare.
  const s = generateDealerSlug({ businessName: "Profile", isTaken: () => false });
  assert.notEqual(s, "profile");
  assert.equal(s, "profile-2");
});
