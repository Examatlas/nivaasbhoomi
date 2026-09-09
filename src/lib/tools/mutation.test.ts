import { test } from "node:test";
import assert from "node:assert/strict";

import { allMutationStates, getMutationState, buildMutation } from "@/data/mutation-guide";
import { mutationTool } from "@/lib/tools/mutation-tool";

test("core states are verified; others are not", () => {
  const states = allMutationStates();
  const bySlug = new Map(states.map((s) => [s.slug, s]));
  assert.equal(bySlug.get("bihar")?.verified, true);
  assert.equal(bySlug.get("jharkhand")?.verified, true);
  assert.equal(bySlug.get("uttar-pradesh")?.verified, true);
  assert.equal(bySlug.get("maharashtra")?.verified, false); // in stamp-duty list, not yet verified here
});

test("verified states give the correct official portal + non-empty steps", () => {
  const bihar = buildMutation(
    { stateSlug: "bihar", propertyType: "residential", transferType: "sale" },
    getMutationState("bihar")!,
  );
  assert.equal(bihar.verified, true);
  assert.match(bihar.portal!.url, /biharbhumi\.bihar\.gov\.in/);
  assert.ok(bihar.steps.length >= 4);

  const jh = buildMutation(
    { stateSlug: "jharkhand", propertyType: "agricultural", transferType: "sale" },
    getMutationState("jharkhand")!,
  );
  assert.match(jh.portal!.url, /jharbhoomi\.jharkhand\.gov\.in/);
  assert.match(jh.note ?? "", /CNT|SPT/); // Jharkhand cross-note to the CNT/SPT checker

  const up = buildMutation(
    { stateSlug: "uttar-pradesh", propertyType: "residential", transferType: "sale" },
    getMutationState("uttar-pradesh")!,
  );
  assert.match(up.portal!.url, /vaad\.up\.nic\.in/);
});

test("unverified state → coming-soon shell (no invented steps)", () => {
  const mh = buildMutation(
    { stateSlug: "maharashtra", propertyType: "residential", transferType: "sale" },
    getMutationState("maharashtra")!,
  );
  assert.equal(mh.verified, false);
  assert.equal(mh.steps.length, 0);
  assert.equal(mh.portal, null);
  assert.match(mh.note ?? "", /coming soon/i);
  // documents still provided generically
  assert.ok(mh.documents.length > 0);
});

test("inheritance transfer adds death + legal-heir certificate to documents", () => {
  const g = buildMutation(
    { stateSlug: "bihar", propertyType: "residential", transferType: "inheritance" },
    getMutationState("bihar")!,
  );
  assert.ok(g.documents.some((d) => /death certificate/i.test(d)));
  assert.ok(g.documents.some((d) => /legal-heir|succession/i.test(d)));
});

test("tool parse: rejects unknown state, accepts valid input", () => {
  assert.equal(mutationTool.parse({ stateSlug: "atlantis", propertyType: "residential", transferType: "sale" }).ok, false);
  assert.equal(mutationTool.parse({ stateSlug: "bihar", propertyType: "residential", transferType: "sale" }).ok, true);
});
