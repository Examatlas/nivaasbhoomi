import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIndianMobile,
  toDisplayPhone,
  generateOtpCode,
  rateLimitDecision,
  cooldownDecision,
  isLockedOut,
  isExpired,
  decideVerify,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_PER_PHONE,
  OTP_RATE_PER_IP,
  RESEND_COOLDOWN_SECONDS,
} from "./otp-login";
import { formatRetryAfter } from "./otp-retry";

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
test("default caps are the new tuned values (5/phone, 30/ip, 30s cooldown)", () => {
  assert.equal(OTP_RATE_PER_PHONE, 5);
  assert.equal(OTP_RATE_PER_IP, 30);
  assert.equal(RESEND_COOLDOWN_SECONDS, 30);
});

test("rateLimitDecision: phone cap trips at 5", () => {
  assert.equal(rateLimitDecision(4, 0).allowed, true); // 4 sends → still allowed
  const blocked = rateLimitDecision(5, 0);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "phone_limit");
  assert.equal(blocked.retryAfter, 3600);
});

test("rateLimitDecision: ip cap trips at 30", () => {
  assert.equal(rateLimitDecision(0, 29).allowed, true);
  const blocked = rateLimitDecision(0, 30);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "ip_limit");
  assert.equal(blocked.retryAfter, 3600);
});

test("rateLimitDecision: phone limit is reported first when both are over", () => {
  assert.equal(rateLimitDecision(5, 30).reason, "phone_limit");
});

// ---- resend cooldown ----
test("cooldownDecision: a second send within the gap is blocked, with retryAfter", () => {
  const now = new Date("2026-01-01T00:00:20Z"); // 20s after the last send
  const last = new Date("2026-01-01T00:00:00Z");
  const d = cooldownDecision(last, now, 30);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "cooldown");
  assert.equal(d.retryAfter, 10); // 30 - 20
});

test("cooldownDecision: allowed once the gap has elapsed, or on a first-ever send", () => {
  const now = new Date("2026-01-01T00:01:00Z"); // 60s later
  assert.equal(cooldownDecision(new Date("2026-01-01T00:00:00Z"), now, 30).allowed, true);
  assert.equal(cooldownDecision(null, now, 30).allowed, true); // never sent
});

// ---- retry-after formatting (client-safe) ----
test("formatRetryAfter: seconds vs minutes, with pluralisation", () => {
  assert.equal(formatRetryAfter(1), "Please try again in 1 second.");
  assert.equal(formatRetryAfter(10), "Please try again in 10 seconds.");
  assert.equal(formatRetryAfter(59), "Please try again in 59 seconds.");
  assert.equal(formatRetryAfter(60), "Please try again in 1 minute.");
  assert.equal(formatRetryAfter(3600), "Please try again in 60 minutes.");
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
