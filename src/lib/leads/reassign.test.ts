import { test } from "node:test";
import assert from "node:assert/strict";

import { isReassignEligible, MAX_REASSIGN } from "./reassign";

const now = new Date("2026-01-01T01:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");
const future = new Date("2026-01-01T02:00:00Z");

test("SLA cron eligibility: unviewed + expired + assigned + non-whatsapp only", () => {
  assert.equal(
    isReassignEligible({ status: "assigned", viewedAt: null, slaDeadline: past, source: "listing" }, now),
    true,
  );
});

test("SLA cron eligibility: whatsapp_click is exempt", () => {
  assert.equal(
    isReassignEligible({ status: "assigned", viewedAt: null, slaDeadline: past, source: "whatsapp_click" }, now),
    false,
  );
});

test("SLA cron eligibility: viewed leads are exempt", () => {
  assert.equal(
    isReassignEligible({ status: "assigned", viewedAt: past, slaDeadline: past, source: "listing" }, now),
    false,
  );
});

test("SLA cron eligibility: not-yet-expired leads are exempt", () => {
  assert.equal(
    isReassignEligible({ status: "assigned", viewedAt: null, slaDeadline: future, source: "listing" }, now),
    false,
  );
});

test("SLA cron eligibility: non-assigned statuses are exempt", () => {
  assert.equal(
    isReassignEligible({ status: "delivered", viewedAt: null, slaDeadline: past, source: "whatsapp_click" }, now),
    false,
  );
  assert.equal(
    isReassignEligible({ status: "unclaimed", viewedAt: null, slaDeadline: past, source: "listing" }, now),
    false,
  );
});

test("max reassign is 3", () => {
  assert.equal(MAX_REASSIGN, 3);
});
