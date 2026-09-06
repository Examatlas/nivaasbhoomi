import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { buildDedupeFilter, DEDUP_WINDOW_MS } from "./dedupe";

const oid = () => new mongoose.Types.ObjectId().toString();

test("dedupe: same buyer + 4 different dealers/listings → 4 distinct filters (4 leads)", () => {
  const phone = "919876543210";
  const listings = [oid(), oid(), oid(), oid()];
  const filters = listings.map((listingId) => buildDedupeFilter({ phone, listingId }));
  const listingKeys = filters.map((f) => String((f as Record<string, unknown>).listingId));
  // all distinct → dedup never collapses different listings/dealers
  assert.equal(new Set(listingKeys).size, 4);
});

test("dedupe: same buyer + same listing → same dedup filter (1 lead)", () => {
  const phone = "919876543210";
  const listingId = oid();
  const a = buildDedupeFilter({ phone, listingId })!;
  const b = buildDedupeFilter({ phone, listingId })!;
  assert.equal(String(a.listingId), String(b.listingId));
  assert.equal(a.phone, b.phone);
});

test("dedupe: agent profile keys on dealer, not listing", () => {
  const f = buildDedupeFilter({ phone: "919876543210", dealerId: oid() })!;
  assert.ok(f.assignedDealerId);
  assert.equal(f.listingId, undefined);
});

test("dedupe: window is 24h and phone-only keys on nothing", () => {
  const now = new Date("2026-01-02T00:00:00Z");
  const f = buildDedupeFilter({ phone: "919876543210", listingId: oid() }, now)!;
  const since = (f.createdAt as { $gte: Date }).$gte;
  assert.equal(now.getTime() - since.getTime(), DEDUP_WINDOW_MS);
  assert.equal(buildDedupeFilter({ phone: "919876543210" }), null); // no phone-only dedup
});
