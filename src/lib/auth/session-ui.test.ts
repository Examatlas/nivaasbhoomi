import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldPromptProfileCompletion, avatarInitial, formatSessionPhone } from "./session-ui";

test("shouldPromptProfileCompletion: only for a logged-in buyer with no name", () => {
  assert.equal(shouldPromptProfileCompletion(null, false), false);
  assert.equal(shouldPromptProfileCompletion({ authed: false }, false), false);
  assert.equal(shouldPromptProfileCompletion({ authed: true, name: null }, false), true);
  assert.equal(shouldPromptProfileCompletion({ authed: true, name: "" }, false), true);
  assert.equal(shouldPromptProfileCompletion({ authed: true, name: "Asha" }, false), false);
});

test("shouldPromptProfileCompletion: never after dismiss", () => {
  assert.equal(shouldPromptProfileCompletion({ authed: true, name: null }, true), false);
});

test("avatarInitial: name first, then phone, then U", () => {
  assert.equal(avatarInitial("asha", "919876543210"), "A");
  assert.equal(avatarInitial(null, "919876543210"), "0");
  assert.equal(avatarInitial("", ""), "U");
});

test("formatSessionPhone: +91 grouping", () => {
  assert.equal(formatSessionPhone("919876543210"), "+91 9876543210");
  assert.equal(formatSessionPhone(null), "");
});
