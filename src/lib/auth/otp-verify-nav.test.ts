import { test } from "node:test";
import assert from "node:assert/strict";

import { safeInternalPath, canSubmitOtp, dealerRegisterNext } from "./otp-verify-nav";

// ---- server register-branch decision (upgrade vs new) ----
test("dealerRegisterNext: existing user → upgrade; brand-new number → new", () => {
  assert.deepEqual(dealerRegisterNext(true), {
    next: "/dealer/register?mode=upgrade",
    mode: "upgrade",
  });
  assert.deepEqual(dealerRegisterNext(false), {
    next: "/dealer/register?mode=new",
    mode: "new",
  });
});

// ---- open-redirect guard for the server-decided `next` ----
test("safeInternalPath: allows a same-origin absolute path", () => {
  assert.equal(safeInternalPath("/dealer/register?mode=upgrade"), "/dealer/register?mode=upgrade");
  assert.equal(safeInternalPath("/dealer/dashboard"), "/dealer/dashboard");
  assert.equal(safeInternalPath("/"), "/");
});

test("safeInternalPath: rejects off-origin / malformed targets", () => {
  assert.equal(safeInternalPath("//evil.com"), null); // protocol-relative
  assert.equal(safeInternalPath("https://evil.com"), null); // absolute URL
  assert.equal(safeInternalPath("http://evil.com"), null);
  assert.equal(safeInternalPath("/\\evil.com"), null); // backslash trick
  assert.equal(safeInternalPath("dealer/register"), null); // not root-relative
  assert.equal(safeInternalPath(""), null);
  assert.equal(safeInternalPath(null), null);
  assert.equal(safeInternalPath(undefined), null);
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
