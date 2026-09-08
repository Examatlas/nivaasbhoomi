import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isFirstOfMonthIST,
  istMonthKey,
  startOfMonthIST,
  nextMonthlyReset,
} from "@/lib/leads/quota-reset-date";
import { hasRemainingQuota } from "@/lib/leads/quota-guard";
import { rankRowsByDealerQuota, type DealerCardInfo } from "@/lib/listings/dealer-card-info";

// ---- reset gating (STEP 3.2) ----

test("isFirstOfMonthIST: true only on the 1st in IST (not UTC)", () => {
  // 2026-02-28T20:00Z = 2026-03-01 01:30 IST → the 1st.
  assert.equal(isFirstOfMonthIST(new Date("2026-02-28T20:00:00Z")), true);
  // 2026-03-01T00:00Z = 2026-03-01 05:30 IST → the 1st.
  assert.equal(isFirstOfMonthIST(new Date("2026-03-01T00:00:00Z")), true);
  // 2026-02-28T17:00Z = 2026-02-28 22:30 IST → still the 28th.
  assert.equal(isFirstOfMonthIST(new Date("2026-02-28T17:00:00Z")), false);
  // Mid-month is never the 1st.
  assert.equal(isFirstOfMonthIST(new Date("2026-03-15T12:00:00Z")), false);
});

test("istMonthKey: stable YYYY-MM in IST, crosses the UTC day boundary", () => {
  assert.equal(istMonthKey(new Date("2026-03-15T12:00:00Z")), "2026-03");
  // Late-Feb UTC that is already March in IST.
  assert.equal(istMonthKey(new Date("2026-02-28T20:00:00Z")), "2026-03");
  // Two runs on the same IST day share a key → idempotent reset.
  assert.equal(
    istMonthKey(new Date("2026-03-01T02:00:00Z")),
    istMonthKey(new Date("2026-03-01T18:00:00Z")),
  );
});

test("startOfMonthIST precedes now; nextMonthlyReset is one month later", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  const start = startOfMonthIST(now);
  const next = nextMonthlyReset(now);
  assert.ok(start.getTime() < now.getTime());
  assert.ok(next.getTime() > now.getTime());
  // start is this month's 1st, next is next month's 1st — a whole month apart.
  assert.equal(istMonthKey(start), "2026-03");
  assert.equal(istMonthKey(next), "2026-04");
});

// ---- quota check (STEP 3.3) ----

test("hasRemainingQuota: 29/30 has room, 30/30 is full (31st blocked)", () => {
  assert.equal(hasRemainingQuota(29, 30), true);
  assert.equal(hasRemainingQuota(30, 30), false);
  assert.equal(hasRemainingQuota(31, 30), false);
});

test("hasRemainingQuota: a stray negative used still counts as room (never crashes)", () => {
  assert.equal(hasRemainingQuota(-2, 30), true);
});

// ---- listing ranking (STEP 3.4) ----

test("rankRowsByDealerQuota: exhausted dealers' rows go last, order otherwise stable", () => {
  const info = new Map<string, DealerCardInfo>([
    ["A", { verificationTier: 0, zenithConnected: false, zenithNumber: null, quotaExhausted: false }],
    ["B", { verificationTier: 0, zenithConnected: false, zenithNumber: null, quotaExhausted: true }],
    ["C", { verificationTier: 0, zenithConnected: false, zenithNumber: null, quotaExhausted: false }],
  ]);
  const rows = [
    { id: 1, dealerId: "B" },
    { id: 2, dealerId: "A" },
    { id: 3, dealerId: "B" },
    { id: 4, dealerId: "C" },
  ];
  const ranked = rankRowsByDealerQuota(rows, info).map((r) => r.id);
  // Available (A, C) keep their relative order first; exhausted (B, B) last.
  assert.deepEqual(ranked, [2, 4, 1, 3]);
});
