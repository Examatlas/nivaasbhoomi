import { test } from "node:test";
import assert from "node:assert/strict";

import {
  istMinutes,
  isWithinAlertWindowIST,
  shouldAutoPause,
  buildListingMatchFilter,
  formatBudgetRange,
  MAX_ACTIVE_ALERTS,
  AUTO_PAUSE_AFTER,
} from "./logic";

// A UTC instant → the IST clock time. 03:30 UTC = 09:00 IST (window opens).
function utc(h: number, m = 0): Date {
  return new Date(Date.UTC(2026, 0, 15, h, m, 0));
}

test("IST window: 9am–8pm IST only", () => {
  // 09:00 IST == 03:30 UTC
  assert.equal(istMinutes(utc(3, 30)), 9 * 60);
  assert.equal(isWithinAlertWindowIST(utc(3, 30)), true); // 9:00 IST
  assert.equal(isWithinAlertWindowIST(utc(14, 0)), true); // 19:30 IST
  assert.equal(isWithinAlertWindowIST(utc(3, 0)), false); // 8:30 IST — too early
  assert.equal(isWithinAlertWindowIST(utc(15, 0)), false); // 20:30 IST — too late
  assert.equal(isWithinAlertWindowIST(utc(20, 0)), false); // 1:30 IST — night
});

test("auto-pause after 3 un-visited alerts", () => {
  assert.equal(AUTO_PAUSE_AFTER, 3);
  assert.equal(shouldAutoPause(0), false);
  assert.equal(shouldAutoPause(2), false);
  assert.equal(shouldAutoPause(3), true);
  assert.equal(shouldAutoPause(4), true);
});

test("max active alerts is 5", () => {
  assert.equal(MAX_ACTIVE_ALERTS, 5);
});

test("buildListingMatchFilter: buy → sale on expectedPrice; new-only via createdAt", () => {
  const since = new Date("2026-01-01T00:00:00Z");
  const f = buildListingMatchFilter(
    { cityId: "665000000000000000000001", purpose: "buy", budgetMin: 2_000_000, budgetMax: 8_000_000, propertyType: "flat", bedrooms: "2", localityIds: ["665000000000000000000002"] },
    since,
  );
  assert.equal(f.status, "approved");
  assert.equal(f.purpose, "sale");
  assert.equal(f.propertyType, "flat");
  assert.equal(f.bhk, "2");
  assert.deepEqual(f.createdAt, { $gt: since });
  assert.deepEqual(f.expectedPrice, { $gte: 2_000_000, $lte: 8_000_000 });
  assert.ok(f.localityId); // $in provided
});

test("buildListingMatchFilter: rent → monthlyRent; no price when budget absent", () => {
  const f = buildListingMatchFilter({ cityId: "665000000000000000000001", purpose: "rent" }, new Date(0));
  assert.equal(f.purpose, "rent");
  assert.equal(f.expectedPrice, undefined);
  assert.equal(f.monthlyRent, undefined); // no budget → no price constraint
  assert.equal(f.localityId, undefined); // no localities → not constrained
});

test("formatBudgetRange: Indian grouping + open-ended", () => {
  assert.equal(formatBudgetRange(2_000_000, 8_000_000), "₹20,00,000–₹80,00,000");
  assert.equal(formatBudgetRange(null, 5_000_000), "up to ₹50,00,000");
  assert.equal(formatBudgetRange(3_000_000, null), "₹30,00,000+");
  assert.equal(formatBudgetRange(null, null), "any budget");
});
