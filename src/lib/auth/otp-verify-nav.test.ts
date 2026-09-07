import { test } from "node:test";
import assert from "node:assert/strict";

import { verifyNavigation, canSubmitOtp } from "./otp-verify-nav";

// ---- every verify branch lands on the right screen ----
test("verifyNavigation: existing dealer → dashboard", () => {
  assert.deepEqual(
    verifyNavigation({ redirect: "/dealer/dashboard" }),
    { kind: "navigate", to: "/dealer/dashboard" },
  );
});

test("verifyNavigation: buyer / linked buyer → their redirect (home)", () => {
  assert.deepEqual(verifyNavigation({ redirect: "/" }), { kind: "navigate", to: "/" });
});

test("verifyNavigation: NEW dealer (no dealer yet) → registration form", () => {
  assert.deepEqual(
    verifyNavigation({ needsRegistration: true, redirect: "/dealer/register" }),
    { kind: "register", to: "/dealer/register" },
  );
});

test("verifyNavigation: registration redirect BEATS ?next (must register first)", () => {
  assert.deepEqual(
    verifyNavigation({ needsRegistration: true, redirect: "/dealer/register" }, { next: "/somewhere" }),
    { kind: "register", to: "/dealer/register" },
  );
});

test("verifyNavigation: a normal success honours ?next", () => {
  assert.deepEqual(
    verifyNavigation({ redirect: "/" }, { next: "/property/abc" }),
    { kind: "navigate", to: "/property/abc" },
  );
});

test("verifyNavigation: unknown / redirect-less success → error (never hang)", () => {
  assert.deepEqual(verifyNavigation({}), { kind: "error" });
  assert.deepEqual(verifyNavigation(null), { kind: "error" });
  assert.deepEqual(verifyNavigation({ needsRegistration: true }), { kind: "error" }); // no redirect
});

// ---- double-submit guard ----
test("canSubmitOtp: only a complete code, nothing in flight, not yet verified", () => {
  assert.equal(canSubmitOtp({ inFlight: false, verified: false, codeLength: 6 }), true);
});

test("canSubmitOtp: blocks a second submit while one is in flight", () => {
  assert.equal(canSubmitOtp({ inFlight: true, verified: false, codeLength: 6 }), false);
});

test("canSubmitOtp: blocks any submit after a successful verify", () => {
  assert.equal(canSubmitOtp({ inFlight: false, verified: true, codeLength: 6 }), false);
});

test("canSubmitOtp: blocks an incomplete code", () => {
  assert.equal(canSubmitOtp({ inFlight: false, verified: false, codeLength: 5 }), false);
});
