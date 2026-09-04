import { test } from "node:test";
import assert from "node:assert/strict";

import { computeEmi, computeEmiYears } from "@/lib/calculators/emi";
import {
  computeStampDuty,
  resolveRate,
  DEFAULT_STAMP_DUTY,
} from "@/lib/calculators/stamp-duty";

// ---- EMI ----

test("EMI: standard case (10L @ 8.5% for 120 months)", () => {
  const r = computeEmi({ principal: 1000000, annualRatePct: 8.5, tenureMonths: 120 });
  // Known good: ~12,398/month.
  assert.ok(Math.abs(r.emi - 12398) <= 2, `emi was ${r.emi}`);
  assert.equal(r.principal, 1000000);
  assert.ok(r.totalInterest > 0);
  assert.equal(r.totalPayment, r.emi * 120);
  assert.equal(r.totalPayment, r.principal + r.totalInterest);
});

test("EMI: zero interest -> principal / n", () => {
  const r = computeEmi({ principal: 120000, annualRatePct: 0, tenureMonths: 12 });
  assert.equal(r.emi, 10000);
  assert.equal(r.totalInterest, 0);
});

test("EMI: zero principal -> all zero", () => {
  const r = computeEmi({ principal: 0, annualRatePct: 9, tenureMonths: 240 });
  assert.deepEqual(r, { emi: 0, principal: 0, totalInterest: 0, totalPayment: 0 });
});

test("EMI: years helper converts to months", () => {
  const a = computeEmiYears(5000000, 9, 20);
  const b = computeEmi({ principal: 5000000, annualRatePct: 9, tenureMonths: 240 });
  assert.deepEqual(a, b);
});

test("EMI: longer tenure lowers the EMI but raises total interest", () => {
  const short = computeEmi({ principal: 5000000, annualRatePct: 9, tenureMonths: 120 });
  const long = computeEmi({ principal: 5000000, annualRatePct: 9, tenureMonths: 240 });
  assert.ok(long.emi < short.emi);
  assert.ok(long.totalInterest > short.totalInterest);
});

// ---- Stamp duty ----

test("stamp duty: 50L at 6% + 1% registration", () => {
  const r = computeStampDuty({ propertyValue: 5000000, ratePct: 6 });
  assert.equal(r.stampDuty, 300000);
  assert.equal(r.registration, 50000);
  assert.equal(r.total, 350000);
});

test("stamp duty: registration override", () => {
  const r = computeStampDuty({ propertyValue: 1000000, ratePct: 5, registrationPct: 0 });
  assert.equal(r.stampDuty, 50000);
  assert.equal(r.registration, 0);
  assert.equal(r.total, 50000);
});

test("resolveRate: DB value wins over the default table", () => {
  assert.equal(resolveRate("MH", "female", { male: 6, female: 3, joint: 6 }), 3);
});

test("resolveRate: falls back to the default table by state code", () => {
  assert.equal(resolveRate("DL", "female"), DEFAULT_STAMP_DUTY.DL!.female); // Delhi women concession
  assert.ok(DEFAULT_STAMP_DUTY.DL!.female < DEFAULT_STAMP_DUTY.DL!.male);
});

test("resolveRate: unknown state -> generic fallback", () => {
  const rate = resolveRate("ZZ", "male");
  assert.equal(rate, 6);
});
