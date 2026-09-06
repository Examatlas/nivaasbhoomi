import { test } from "node:test";
import assert from "node:assert/strict";

import { loginMethods } from "./login-config";

test("loginMethods: buyer is WhatsApp OTP only — never a password field", () => {
  assert.deepEqual(loginMethods("buyer"), { otp: true, password: false });
});

test("loginMethods: dealer offers OTP primary + password fallback", () => {
  assert.deepEqual(loginMethods("dealer"), { otp: true, password: true });
});

test("loginMethods: admin stays email+password only", () => {
  assert.deepEqual(loginMethods("admin"), { otp: false, password: true });
});
