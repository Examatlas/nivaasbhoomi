import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldPromptProfileCompletion,
  avatarInitial,
  formatSessionPhone,
  encodeSessionHint,
  decodeSessionHint,
  readCookie,
} from "./session-ui";

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

test("session hint: round-trips an authenticated buyer (no fetch needed)", () => {
  const raw = encodeSessionHint({ a: 1, n: "Asha", p: "919876543210", d: "665abc" });
  const me = decodeSessionHint(raw);
  assert.equal(me?.authed, true);
  assert.equal(me?.name, "Asha");
  assert.equal(me?.phone, "919876543210");
  assert.equal(me?.dealerId, "665abc");
  assert.equal(me?.profileComplete, true); // has a name
});

test("session hint: a:0 is a DEFINITE logged-out state (shows Sign in instantly)", () => {
  assert.deepEqual(decodeSessionHint(encodeSessionHint({ a: 0 })), { authed: false });
});

test("session hint: authed with no name → profileComplete false", () => {
  const me = decodeSessionHint(encodeSessionHint({ a: 1, n: null, p: "919000000000" }));
  assert.equal(me?.authed, true);
  assert.equal(me?.profileComplete, false);
});

test("session hint: absent / malformed → null (unknown, caller falls back once)", () => {
  assert.equal(decodeSessionHint(undefined), null);
  assert.equal(decodeSessionHint(""), null);
  assert.equal(decodeSessionHint("not-json"), null);
  assert.equal(decodeSessionHint(encodeSessionHint({ a: 5 as unknown as 0 })), null);
});

test("readCookie: extracts one cookie value from a document.cookie string", () => {
  const jar = "foo=1; nb_session_hint=%7B%22a%22%3A1%7D; bar=2";
  assert.equal(readCookie(jar, "nb_session_hint"), "%7B%22a%22%3A1%7D");
  assert.equal(readCookie(jar, "missing"), null);
  assert.equal(readCookie("", "x"), null);
});
