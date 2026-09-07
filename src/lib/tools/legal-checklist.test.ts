import { test } from "node:test";
import assert from "node:assert/strict";

import { legalChecklistTool } from "./legal-checklist-tool";
import { buildChecklist, getLegalState } from "@/data/legal-checklist";
import { buildDedupeFilter } from "@/lib/leads/dedupe";
import { isReassignEligible } from "@/lib/leads/reassign";

function keys(input: { stateSlug: string; propertyType: string; purchaseType: string }): string[] {
  const state = getLegalState(input.stateSlug)!;
  return buildChecklist(input as never, state).sections.map((s) => s.key);
}

test("legalChecklistTool.parse: accepts valid input, rejects unknown state / bad enums", () => {
  assert.equal(legalChecklistTool.parse({ stateSlug: "jharkhand", propertyType: "flat", purchaseType: "resale" }).ok, true);
  assert.equal(legalChecklistTool.parse({ stateSlug: "narnia", propertyType: "flat", purchaseType: "resale" }).ok, false);
  assert.equal(legalChecklistTool.parse({ stateSlug: "jharkhand", propertyType: "spaceship", purchaseType: "resale" }).ok, false);
});

test("checklist: flat + resale includes society NOC and building/OC", () => {
  const k = keys({ stateSlug: "maharashtra", propertyType: "flat", purchaseType: "resale" });
  assert.ok(k.includes("society"));
  assert.ok(k.includes("building"));
  assert.ok(k.includes("title") && k.includes("encumbrance") && k.includes("mutation"));
});

test("checklist: plot + new-builder excludes society and building", () => {
  const k = keys({ stateSlug: "maharashtra", propertyType: "plot", purchaseType: "new_builder" });
  assert.ok(!k.includes("society"));
  assert.ok(!k.includes("building"));
  assert.ok(k.includes("landuse")); // plot → land-use section
});

test("checklist: under-construction includes RERA; agricultural includes land-use", () => {
  assert.ok(keys({ stateSlug: "maharashtra", propertyType: "flat", purchaseType: "under_construction" }).includes("rera"));
  assert.ok(keys({ stateSlug: "maharashtra", propertyType: "agricultural", purchaseType: "resale" }).includes("landuse"));
});

test("checklist: red flags always present; a generic state has no state-specific section", () => {
  const state = getLegalState("kerala")!; // kerala: generic only (not in the verified map)
  const out = buildChecklist({ stateSlug: "kerala", propertyType: "flat", purchaseType: "resale" }, state);
  assert.ok(out.redFlags.length > 0);
  assert.equal(out.hasStateSpecific, false);
  assert.ok(!out.sections.some((s) => s.key === "state"));
  assert.equal(out.disclaimer.length > 0, true);
});

test("checklist: Jharkhand includes the verified CNT/SPT state-specific section + red flags", () => {
  const state = getLegalState("jharkhand")!;
  const out = buildChecklist({ stateSlug: "jharkhand", propertyType: "plot", purchaseType: "resale" }, state);
  assert.equal(out.hasStateSpecific, true);
  const stateSection = out.sections.find((s) => s.key === "state");
  assert.ok(stateSection, "expected a state-specific section");
  assert.match(stateSection!.title, /CNT|SPT/);
  // Santhal Pargana districts named; DC-permission red flag present.
  assert.ok(out.redFlags.some((f) => /Santhal Pargana|Deputy Commissioner/.test(f)));
  assert.ok(out.portals.some((p) => /jharbhoomi/i.test(p.url)));
});

test("checklist tool dedups on its own source + SLA cron skips it", () => {
  const f = buildDedupeFilter({ phone: "919876543210", source: "tool_legal_checklist" });
  assert.equal(f!.source, "tool_legal_checklist");
  const past = new Date(Date.now() - 60_000);
  assert.equal(isReassignEligible({ status: "assigned", viewedAt: null, slaDeadline: past, source: "tool_legal_checklist" }), false);
});
