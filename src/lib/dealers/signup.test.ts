import { test } from "node:test";
import assert from "node:assert/strict";

import {
  signupRateLimitDecision,
  isDuplicateSignup,
  normalizeBusinessName,
  SIGNUP_RATE_PER_IP,
  SIGNUP_RATE_WINDOW_SECONDS,
} from "./signup";

test("signupRateLimitDecision: allows under the cap, blocks at/over it", () => {
  assert.equal(signupRateLimitDecision(0).allowed, true);
  assert.equal(signupRateLimitDecision(SIGNUP_RATE_PER_IP - 1).allowed, true);
  const blocked = signupRateLimitDecision(SIGNUP_RATE_PER_IP);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, SIGNUP_RATE_WINDOW_SECONDS);
  assert.equal(signupRateLimitDecision(SIGNUP_RATE_PER_IP + 5).allowed, false);
});

test("normalizeBusinessName: trims, lowercases, collapses whitespace", () => {
  assert.equal(normalizeBusinessName("  Sharma   Realty  "), "sharma realty");
  assert.equal(normalizeBusinessName("SHARMA REALTY"), "sharma realty");
});

test("isDuplicateSignup: same name + overlapping city → duplicate", () => {
  const existing = [{ businessName: "Sharma Realty", cities: ["c1", "c2"] }];
  assert.equal(
    isDuplicateSignup({ businessName: "sharma realty", cities: ["c2"] }, existing),
    true,
  );
});

test("isDuplicateSignup: same name but NO shared city → not a duplicate", () => {
  const existing = [{ businessName: "Sharma Realty", cities: ["c1"] }];
  assert.equal(
    isDuplicateSignup({ businessName: "Sharma Realty", cities: ["c9"] }, existing),
    false,
  );
});

test("isDuplicateSignup: shared city but different name → not a duplicate", () => {
  const existing = [{ businessName: "Verma Estates", cities: ["c1"] }];
  assert.equal(
    isDuplicateSignup({ businessName: "Sharma Realty", cities: ["c1"] }, existing),
    false,
  );
});

test("isDuplicateSignup: empty candidate name is never a duplicate", () => {
  assert.equal(isDuplicateSignup({ businessName: "  ", cities: ["c1"] }, [
    { businessName: "", cities: ["c1"] },
  ]), false);
});
