import { test } from "node:test";
import assert from "node:assert/strict";

import { possessionLabel, isUnderConstruction } from "./listing-format";

test("possessionLabel: known statuses map to card/detail labels", () => {
  assert.equal(possessionLabel("ready-to-move"), "Ready to Move");
  assert.equal(possessionLabel("under-construction"), "Under Construction");
});

test("possessionLabel: unset → null (tag/row hidden)", () => {
  assert.equal(possessionLabel(undefined), null);
  assert.equal(possessionLabel(null), null);
  assert.equal(possessionLabel(""), null);
});

test("possessionLabel: unknown value is title-cased, not dropped", () => {
  assert.equal(possessionLabel("new-launch"), "New Launch");
});

test("isUnderConstruction: only true for under-construction", () => {
  assert.equal(isUnderConstruction("under-construction"), true);
  assert.equal(isUnderConstruction("ready-to-move"), false);
  assert.equal(isUnderConstruction(undefined), false);
});
