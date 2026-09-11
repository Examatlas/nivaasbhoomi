import { test } from "node:test";
import assert from "node:assert/strict";

import { buildRejectReason, REJECT_REASONS } from "./reject-reasons";
import { sanitizeTemplateParam } from "@/lib/notifications/dealer-events";

test("buildRejectReason: labels comma-joined, then free text", () => {
  const s = buildRejectReason(["unclear_photos", "price_incorrect"], "Photos are blurry");
  assert.equal(s, "Photos are unclear or low quality, Price looks incorrect — Photos are blurry");
});

test("buildRejectReason: checkboxes only (no note)", () => {
  assert.equal(buildRejectReason(["duplicate"], ""), "Duplicate listing");
});

test("buildRejectReason: note only (no checkboxes)", () => {
  assert.equal(buildRejectReason([], "Just a custom note"), "Just a custom note");
});

test("buildRejectReason: unknown values are ignored", () => {
  assert.equal(buildRejectReason(["bogus", "duplicate"], ""), "Duplicate listing");
});

test("reject reasons: 9 options, all with value+label", () => {
  assert.equal(REJECT_REASONS.length, 9);
  assert.ok(REJECT_REASONS.every((r) => r.value && r.label));
});

test("WhatsApp reason: >200 chars truncates at a word boundary with an ellipsis", () => {
  const values = REJECT_REASONS.map((r) => r.value); // all 9 → well over 200 chars
  const full = buildRejectReason(values, "and some extra explanation from the admin here");
  assert.ok(full.length > 200, "precondition: full reason exceeds 200");
  const wa = sanitizeTemplateParam(full, 200);
  assert.ok(wa.length <= 200, `truncated length ${wa.length} must be <= 200`);
  assert.ok(wa.endsWith("…"), "ends with ellipsis");
  // No word is cut mid-way: the char before the ellipsis is not a partial token
  // boundary — i.e. the truncation happened at a space in the original.
  const body = wa.slice(0, -1);
  assert.ok(full.startsWith(body), "kept text is a prefix of the full reason");
  assert.ok(full[body.length] === " " || full[body.length] === undefined, "cut at a space");
});

test("WhatsApp reason: newlines/tabs stripped, short reason unchanged", () => {
  assert.equal(sanitizeTemplateParam("Bad photos.\nResubmit.", 200), "Bad photos. Resubmit.");
  assert.equal(sanitizeTemplateParam("Duplicate listing", 200), "Duplicate listing");
});
