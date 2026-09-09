import { test } from "node:test";
import assert from "node:assert/strict";

import {
  allCntSptDistricts,
  getCntSptDistrict,
  buildCntSpt,
} from "@/data/cnt-spt-districts";
import { cntSptTool } from "@/lib/tools/cnt-spt-tool";

test("all 24 Jharkhand districts are classified: 18 CNT + 6 SPT", () => {
  const all = allCntSptDistricts();
  assert.equal(all.length, 24);
  assert.equal(all.filter((d) => d.act === "CNT").length, 18);
  assert.equal(all.filter((d) => d.act === "SPT").length, 6);
});

test("district → correct Act (verified division mapping)", () => {
  assert.equal(getCntSptDistrict("ranchi")?.act, "CNT");
  assert.equal(getCntSptDistrict("bokaro")?.act, "CNT");
  assert.equal(getCntSptDistrict("east-singhbhum")?.act, "CNT"); // Kolhan
  assert.equal(getCntSptDistrict("dumka")?.act, "SPT");
  assert.equal(getCntSptDistrict("sahibganj")?.act, "SPT");
  assert.equal(getCntSptDistrict("jamtara")?.act, "SPT");
});

test("unknown district resolves to null (never guessed)", () => {
  assert.equal(getCntSptDistrict("nowhere"), null);
  assert.equal(getCntSptDistrict(""), null);
});

test("verdicts are conservative: non-tribal on CNT/SPT land is NOT allowed", () => {
  const ranchi = getCntSptDistrict("ranchi")!;
  const dumka = getCntSptDistrict("dumka")!;
  assert.equal(
    buildCntSpt({ districtSlug: "ranchi", buyerType: "non_tribal", landType: "residential" }, ranchi).verdict,
    "not_allowed",
  );
  assert.equal(
    buildCntSpt({ districtSlug: "dumka", buyerType: "non_tribal", landType: "agricultural" }, dumka).verdict,
    "not_allowed",
  );
  // Tribal buyer is RESTRICTED (needs DC permission), not a clean yes.
  assert.equal(
    buildCntSpt({ districtSlug: "ranchi", buyerType: "tribal", landType: "residential" }, ranchi).verdict,
    "restricted",
  );
});

test("Kolhan Government Estate rule (Sec 46(3)): full for W.Singhbhum/Seraikela, partial for E.Singhbhum, none elsewhere", () => {
  const ws = getCntSptDistrict("west-singhbhum")!;
  const sk = getCntSptDistrict("seraikela-kharsawan")!;
  const es = getCntSptDistrict("east-singhbhum")!;
  const rn = getCntSptDistrict("ranchi")!;
  const mk = (d: typeof ws) =>
    buildCntSpt({ districtSlug: d.slug, buyerType: "non_tribal", landType: "residential" }, d).kolhanRule;
  assert.equal(mk(ws)?.level, "full");
  assert.equal(mk(sk)?.level, "full");
  assert.equal(mk(es)?.level, "partial");
  assert.equal(mk(rn), null); // non-Kolhan CNT district → no special box
  // citation is Section 46(3), not 48
  assert.match(mk(ws)!.section, /46\(3\)/);
  assert.ok(!/section\s*48/i.test(mk(ws)!.section + mk(ws)!.text + mk(ws)!.quote));
});

test("output carries the act name, home-loan warning, caveat and sources", () => {
  const d = getCntSptDistrict("ranchi")!;
  const out = buildCntSpt({ districtSlug: "ranchi", buyerType: "sc", landType: "residential" }, d);
  assert.match(out.actName, /Chotanagpur Tenancy Act, 1908/);
  assert.match(out.homeLoanWarning, /home loan/i);
  assert.ok(out.caveat.length > 0);
  assert.ok(out.sources.length >= 1 && out.sources.every((u) => u.startsWith("http")));
});

test("tool parse: rejects unknown district + bad buyer, accepts valid input", () => {
  assert.equal(cntSptTool.parse({ districtSlug: "nope", buyerType: "tribal", landType: "residential" }).ok, false);
  assert.equal(cntSptTool.parse({ districtSlug: "ranchi", buyerType: "alien", landType: "residential" }).ok, false);
  const good = cntSptTool.parse({ districtSlug: "ranchi", buyerType: "non_tribal", landType: "residential" });
  assert.equal(good.ok, true);
});
