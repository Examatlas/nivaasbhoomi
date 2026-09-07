import { test } from "node:test";
import assert from "node:assert/strict";

import { isTimeout } from "./auth-nav";

test("isTimeout: recognises abort/timeout errors so the UI shows a clear message", () => {
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  assert.equal(isTimeout(timeout), true);

  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(isTimeout(abort), true);
});

test("isTimeout: a normal failure is NOT a timeout", () => {
  assert.equal(isTimeout(new Error("boom")), false);
  assert.equal(isTimeout(null), false);
  assert.equal(isTimeout(undefined), false);
  assert.equal(isTimeout("nope"), false);
});
