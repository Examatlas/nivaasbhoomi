import { test } from "node:test";
import assert from "node:assert/strict";

import { gaEnabled, gaMeasurementId } from "@/lib/analytics/config";

// process.env.NODE_ENV is typed read-only by @types/node — cast to a mutable
// map so the test can toggle it.
const env = process.env as Record<string, string | undefined>;

function withEnv(nodeEnv: string | undefined, ga: string | undefined, fn: () => void) {
  const on = env.NODE_ENV;
  const og = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
  if (ga === undefined) delete env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else env.NEXT_PUBLIC_GA_MEASUREMENT_ID = ga;
  try {
    fn();
  } finally {
    if (on === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = on;
    if (og === undefined) delete env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else env.NEXT_PUBLIC_GA_MEASUREMENT_ID = og;
  }
}

test("GA is OFF when the env var is missing — even in production", () => {
  withEnv("production", undefined, () => {
    assert.equal(gaMeasurementId(), "");
    assert.equal(gaEnabled(), false);
  });
});

test("GA is OFF in development even when the env var is set", () => {
  withEnv("development", "G-TEST123", () => {
    assert.equal(gaEnabled(), false);
  });
});

test("GA is OFF in the test environment", () => {
  withEnv("test", "G-TEST123", () => {
    assert.equal(gaEnabled(), false);
  });
});

test("GA is ON only in production with the env var set", () => {
  withEnv("production", "G-TEST123", () => {
    assert.equal(gaMeasurementId(), "G-TEST123");
    assert.equal(gaEnabled(), true);
  });
});
