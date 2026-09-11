import { test } from "node:test";
import assert from "node:assert/strict";

import { toZenithParams } from "@/lib/whatsapp/templates";

test("toZenithParams: dealer_approved → 1 bodyParam, no button, lang en", () => {
  const b = toZenithParams("dealer_approved", { dealerName: "Sujit" });
  assert.equal(b.template, "dealer_approved");
  assert.equal(b.language, "en");
  assert.deepEqual(b.bodyParams, ["Sujit"]);
  assert.equal(b.buttonParams, undefined);
});

test("toZenithParams: listing_updated → 3 bodyParams (name, title, summary)", () => {
  const b = toZenithParams("listing_updated", {
    dealerName: "Sujit",
    listingTitle: "2 BHK in Baner",
    changeSummary: "Title, description updated.",
  });
  assert.equal(b.template, "listing_updated");
  assert.deepEqual(b.bodyParams, ["Sujit", "2 BHK in Baner", "Title, description updated."]);
  assert.equal(b.buttonParams, undefined);
});

test("toZenithParams: listing_rejected → 3 bodyParams in order", () => {
  const b = toZenithParams("listing_rejected", {
    dealerName: "Sujit",
    listingTitle: "2 BHK in Baner",
    reason: "Photos unclear",
  });
  assert.deepEqual(b.bodyParams, ["Sujit", "2 BHK in Baner", "Photos unclear"]);
});

test("toZenithParams: listing_approved → 2 bodyParams + URL button {index,type,value}", () => {
  const b = toZenithParams("listing_approved", {
    dealerName: "Sujit",
    listingTitle: "2 BHK in Baner",
    listingSlug: "2-bhk-flat-baner-xyz",
  });
  assert.deepEqual(b.bodyParams, ["Sujit", "2 BHK in Baner"]);
  assert.deepEqual(b.buttonParams, [{ index: 0, type: "url", value: "2-bhk-flat-baner-xyz" }]);
});

test("toZenithParams: property_alert → 4 bodyParams + button (token)", () => {
  const b = toZenithParams("property_alert", {
    buyerName: "Sujit",
    count: "3",
    area: "Baner",
    budget: "under ₹90L",
    token: "tok_abc",
  });
  assert.equal(b.bodyParams.length, 4);
  assert.equal(b.buttonParams?.[0]?.value, "tok_abc");
});

test("toZenithParams: URL-button template with EMPTY button value → clean error, no call", () => {
  assert.throws(
    () =>
      toZenithParams("listing_approved", {
        dealerName: "Sujit",
        listingTitle: "2 BHK",
        listingSlug: "   ", // empty/whitespace → invalid button param
      }),
    /requires a URL button parameter/,
  );
});
