import { test } from "node:test";
import assert from "node:assert/strict";

import { canReassign, slaDeadlineForReassign } from "./assign";
import { hasExhaustedAutoReassign, MAX_REASSIGN } from "./reassign";

test("canReassign: every non-closed status is reassignable", () => {
  for (const s of ["new", "assigned", "delivered", "contacted", "unclaimed", "quota-exceeded", "unmatched"]) {
    assert.equal(canReassign(s), true, `${s} should be reassignable`);
  }
});

test("canReassign: converted / lost are NOT reassignable", () => {
  assert.equal(canReassign("converted"), false);
  assert.equal(canReassign("lost"), false);
});

test("slaDeadlineForReassign: whatsapp_click stays SLA-exempt (null)", () => {
  assert.equal(slaDeadlineForReassign("whatsapp_click", new Date()), null);
});

test("slaDeadlineForReassign: other sources get now + 30 min", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const d = slaDeadlineForReassign("listing", now);
  assert.ok(d);
  assert.equal(d!.getTime() - now.getTime(), 30 * 60 * 1000);
});

test("manual reassigns don't exhaust the auto limit", () => {
  // autoReassignCount drives the limit — reassignCount (incl. manual) does not.
  assert.equal(hasExhaustedAutoReassign(0), false);
  assert.equal(hasExhaustedAutoReassign(2), false);
  assert.equal(hasExhaustedAutoReassign(MAX_REASSIGN), true);
  // A lead reassigned 10 times manually but 0 times by cron is NOT exhausted.
  assert.equal(hasExhaustedAutoReassign(0), false);
});
