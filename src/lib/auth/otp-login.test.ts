import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIndianMobile,
  toDisplayPhone,
  generateOtpCode,
  rateLimitDecision,
  isLockedOut,
  isExpired,
  decideVerify,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
} from "./otp-login";

// ---- phone normalization ----
test("normalizeIndianMobile: canonicalises common formats to 91XXXXXXXXXX", () => {
  assert.equal(normalizeIndianMobile("9876543210"), "919876543210");
  assert.equal(normalizeIndianMobile("+91 98765 43210"), "919876543210");
  assert.equal(normalizeIndianMobile("098765-43210"), "919876543210");
  assert.equal(normalizeIndianMobile("91 9876543210"), "919876543210");
  assert.equal(normalizeIndianMobile("00919876543210".replace("00", "0")), "919876543210");
});

test("normalizeIndianMobile: rejects invalid numbers", () => {
  assert.equal(normalizeIndianMobile("1234567890"), null); // starts with 1
  assert.equal(normalizeIndianMobile("98765"), null); // too short
  assert.equal(normalizeIndianMobile("98765432109999"), null); // too long
  assert.equal(normalizeIndianMobile("5876543210"), null); // starts 5
  assert.equal(normalizeIndianMobile(""), null);
});

test("toDisplayPhone: adds the +", () => {
  assert.equal(toDisplayPhone("919876543210"), "+919876543210");
});

test("generateOtpCode: always a 6-digit string", () => {
  for (let i = 0; i < 200; i++) {
    const c = generateOtpCode();
    assert.match(c, /^\d{6}$/);
  }
});

// ---- rate limit ----
test("rateLimitDecision: blocks at 3/phone and 10/ip", () => {
  assert.equal(rateLimitDecision(0, 0).allowed, true);
  assert.equal(rateLimitDecision(2, 9).allowed, true);
  assert.equal(rateLimitDecision(3, 0).allowed, false); // phone cap
  assert.equal(rateLimitDecision(0, 10).allowed, false); // ip cap
  assert.equal(rateLimitDecision(3, 0).retryAfter, 3600);
});

// ---- attempt lockout ----
test("isLockedOut: burns after 5 attempts", () => {
  assert.equal(isLockedOut(0), false);
  assert.equal(isLockedOut(4), false);
  assert.equal(isLockedOut(OTP_MAX_ATTEMPTS), true);
  assert.equal(isLockedOut(6), true);
});

// ---- expiry ----
test("isExpired: true only past the TTL", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const within = new Date(created.getTime() + (OTP_TTL_SECONDS - 1) * 1000);
  const past = new Date(created.getTime() + (OTP_TTL_SECONDS + 1) * 1000);
  assert.equal(isExpired(created, within), false);
  assert.equal(isExpired(created, past), true);
});

// ---- verify outcomes ----
test("decideVerify: existing dealer signs in; a new number registers; buyer auto-creates", () => {
  assert.equal(decideVerify("dealer", true), "ok-dealer"); // existing dealer → dashboard
  assert.equal(decideVerify("dealer", false), "register-dealer"); // no dealer → self-registration
  assert.equal(decideVerify("buyer", true), "ok-user");
  assert.equal(decideVerify("buyer", false), "create-user"); // buyer auto-create
});
