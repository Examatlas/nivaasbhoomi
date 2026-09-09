import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeTemplateParam } from "./dealer-events";
import { TEMPLATES } from "@/lib/whatsapp/templates";

test("sanitize: strips newlines/tabs, collapses whitespace, trims", () => {
  assert.equal(sanitizeTemplateParam("  hello\n\nworld\t!  "), "hello world !");
  assert.equal(sanitizeTemplateParam("a\r\nb"), "a b");
  assert.equal(sanitizeTemplateParam("x     y"), "x y");
});

test("sanitize: caps length (default 200, custom honoured)", () => {
  assert.equal(sanitizeTemplateParam("a".repeat(500)).length, 200);
  assert.equal(sanitizeTemplateParam("a".repeat(500), 60).length, 60);
});

test("sanitize: null/undefined → empty string", () => {
  assert.equal(sanitizeTemplateParam(null), "");
  assert.equal(sanitizeTemplateParam(undefined), "");
});

test("sanitize: a Meta template can never receive a raw newline", () => {
  const dirty = "Bad photos.\nResubmit with clearer images.\n\n— Admin";
  assert.ok(!sanitizeTemplateParam(dirty).includes("\n"));
});

test("templates: the 3 dealer-lifecycle templates are utility/en", () => {
  for (const name of ["dealer_approved", "listing_approved", "listing_rejected"] as const) {
    assert.equal(TEMPLATES[name].category, "utility", `${name} category`);
    assert.equal(TEMPLATES[name].language, "en", `${name} language`);
    assert.equal(TEMPLATES[name].name, name, `${name} wa-name`);
  }
});

test("templates: dealer_approved has one body param (name)", () => {
  const c = TEMPLATES.dealer_approved.build({ dealerName: "Asha Realty" });
  assert.equal(c.length, 1);
  assert.deepEqual(c[0]!.parameters, [{ type: "text", text: "Asha Realty" }]);
});

test("templates: listing_approved has 2 body params + a dynamic URL button (slug)", () => {
  const c = TEMPLATES.listing_approved.build({
    dealerName: "Asha",
    listingTitle: "2 BHK in Baner",
    listingSlug: "2-bhk-flat-baner-xyz",
  });
  const bodyComp = c.find((x) => x.type === "body")!;
  assert.deepEqual(
    bodyComp.parameters.map((p) => p.text),
    ["Asha", "2 BHK in Baner"],
  );
  const btn = c.find((x) => x.type === "button")!;
  assert.equal(btn.sub_type, "url");
  assert.equal(btn.index, "0");
  assert.deepEqual(btn.parameters, [{ type: "text", text: "2-bhk-flat-baner-xyz" }]);
});

test("templates: listing_rejected carries name, title and reason in order", () => {
  const c = TEMPLATES.listing_rejected.build({
    dealerName: "Asha",
    listingTitle: "2 BHK in Baner",
    reason: "Photos unclear",
  });
  assert.equal(c.length, 1);
  assert.deepEqual(
    c[0]!.parameters.map((p) => p.text),
    ["Asha", "2 BHK in Baner", "Photos unclear"],
  );
});
