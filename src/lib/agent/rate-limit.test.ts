import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agentRateLimitDecision,
  AGENT_RATE_PER_MINUTE,
  AGENT_RATE_PER_DAY,
} from "./rate-limit";

test("rate-limit: under both limits → allowed", () => {
  const d = agentRateLimitDecision(0, 0);
  assert.equal(d.allowed, true);
  assert.equal(d.retryAfter, 0);
});

test("rate-limit: just below the minute cap is still allowed", () => {
  const d = agentRateLimitDecision(AGENT_RATE_PER_MINUTE - 1, 0);
  assert.equal(d.allowed, true);
});

test("rate-limit: at the minute cap → blocked, Retry-After 60s", () => {
  const d = agentRateLimitDecision(AGENT_RATE_PER_MINUTE, 5);
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfter, 60);
});

test("rate-limit: minute ok but day cap hit → blocked, Retry-After 3600s", () => {
  const d = agentRateLimitDecision(1, AGENT_RATE_PER_DAY);
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfter, 3600);
});

test("rate-limit: minute cap takes precedence over day cap", () => {
  // Both exceeded → the shorter (minute) backoff is returned.
  const d = agentRateLimitDecision(AGENT_RATE_PER_MINUTE + 10, AGENT_RATE_PER_DAY + 10);
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfter, 60);
});

test("rate-limit: caps are the spec'd 60/min and 2000/day", () => {
  assert.equal(AGENT_RATE_PER_MINUTE, 60);
  assert.equal(AGENT_RATE_PER_DAY, 2000);
});
