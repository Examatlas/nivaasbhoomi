import { test } from "node:test";
import assert from "node:assert/strict";

import { toolRateLimitDecision, TOOL_RATE_PER_IP } from "./rate-limit";
import { stampDutyTool } from "./stamp-duty-tool";
import { computeStampDutyBreakdown } from "@/lib/calculators/stamp-duty";
import { buildDedupeFilter } from "@/lib/leads/dedupe";
import { isReassignEligible } from "@/lib/leads/reassign";

// ---- tool submission rate limit (5/hour/IP) ----
test("toolRateLimitDecision: allows under the cap, blocks at it", () => {
  assert.equal(toolRateLimitDecision(0).allowed, true);
  assert.equal(toolRateLimitDecision(TOOL_RATE_PER_IP - 1).allowed, true);
  const blocked = toolRateLimitDecision(TOOL_RATE_PER_IP);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 3600);
});

// ---- stamp-duty breakdown math ----
test("computeStampDutyBreakdown: itemises stamp duty, registration, totals", () => {
  const r = computeStampDutyBreakdown({ propertyValue: 5_000_000, stampDutyPct: 5, registrationPct: 1, baseStampDutyPct: 6 });
  assert.equal(r.stampDuty, 250_000);
  assert.equal(r.registration, 50_000);
  assert.equal(r.totalAdditional, 300_000);
  assert.equal(r.grandTotal, 5_300_000);
  assert.equal(r.rebate, 50_000); // 1% of value saved vs the 6% base
});

test("computeStampDutyBreakdown: no rebate when the rate equals the base", () => {
  const r = computeStampDutyBreakdown({ propertyValue: 1_000_000, stampDutyPct: 6, registrationPct: 1, baseStampDutyPct: 6 });
  assert.equal(r.rebate, 0);
});

// ---- stamp-duty tool: parse guards + authoritative compute ----
test("stampDutyTool.parse: accepts a verified state", () => {
  const res = stampDutyTool.parse({
    stateSlug: "maharashtra", propertyValue: 5_000_000,
    buyerType: "female", propertyType: "residential", areaType: "urban",
  });
  assert.equal(res.ok, true);
});

test("stampDutyTool.parse: REJECTS a null-rate state (never shows a guessed number)", () => {
  const res = stampDutyTool.parse({
    stateSlug: "madhya-pradesh", propertyValue: 5_000_000,
    buyerType: "male", propertyType: "residential", areaType: "urban",
  });
  assert.equal(res.ok, false);
});

test("stampDutyTool.parse: rejects an unknown state and a bad value", () => {
  assert.equal(stampDutyTool.parse({ stateSlug: "narnia", propertyValue: 1, buyerType: "male", propertyType: "residential", areaType: "urban" }).ok, false);
  assert.equal(stampDutyTool.parse({ stateSlug: "delhi", propertyValue: -5, buyerType: "male", propertyType: "residential", areaType: "urban" }).ok, false);
});

test("stampDutyTool.compute: Delhi female gets the concession vs male", () => {
  const input = { stateSlug: "delhi", propertyValue: 10_000_000, buyerType: "female", propertyType: "residential", areaType: "urban" } as const;
  const parsed = stampDutyTool.parse(input);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const out = stampDutyTool.compute(parsed.input) as { stampDuty: number; rebate: number; stampDutyPct: number };
  assert.equal(out.stampDutyPct, 4); // Delhi female
  assert.equal(out.stampDuty, 400_000); // 4% of 1 crore
  assert.equal(out.rebate, 200_000); // vs 6% male → 2% saved
});

// ---- dedup extended with the tool source key ----
test("buildDedupeFilter: tool leads dedup on phone + source (no listing/dealer)", () => {
  const f = buildDedupeFilter({ phone: "919876543210", source: "tool_stamp_duty" });
  assert.ok(f);
  assert.equal(f!.phone, "919876543210");
  assert.equal(f!.source, "tool_stamp_duty");
  assert.equal(f!.listingId, undefined);
  assert.equal(f!.assignedDealerId, undefined);
});

// ---- SLA cron never touches tool / unassigned leads ----
test("isReassignEligible: a tool lead is skipped by the SLA cron", () => {
  const past = new Date(Date.now() - 60_000);
  // Even if it somehow looked 'assigned', the source guard excludes it.
  assert.equal(
    isReassignEligible({ status: "assigned", viewedAt: null, slaDeadline: past, source: "tool_stamp_duty" }),
    false,
  );
  // And an unassigned tool lead is excluded by the status gate.
  assert.equal(
    isReassignEligible({ status: "unassigned", viewedAt: null, slaDeadline: past, source: "tool_stamp_duty" }),
    false,
  );
});
