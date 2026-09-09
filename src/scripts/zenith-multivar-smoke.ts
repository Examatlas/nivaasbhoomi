/**
 * Live test for the multi-variable Zenith path. Sends REAL WhatsApp messages via
 * Zenith (WHATSAPP_PROVIDER=zenith), and checks the fallback/guard/logging.
 *
 * Requires: ZENITHCODE_API_KEY (.env.local) + AGENT_SMOKE_TEST_MONGODB_URI (a
 * throwaway DB for the WhatsAppSendLog assertion). Forces WHATSAPP_PROVIDER=zenith.
 *
 *   $env:MONGODB_URI=$env:AGENT_SMOKE_TEST_MONGODB_URI; $env:WHATSAPP_PROVIDER="zenith"
 *   npx tsx src/scripts/zenith-multivar-smoke.ts --to 919288487841
 */
import { resolve } from "node:path";
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(resolve(process.cwd(), f));
  } catch {
    /* optional */
  }
}
process.env.WHATSAPP_PROVIDER = "zenith"; // force the Zenith path for this test

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { notifyDealer } from "@/lib/notifications/dealer-events";
import { sendBusinessTemplate } from "@/lib/whatsapp/send";
import { sendZenithBusinessTemplate } from "@/lib/whatsapp/zenith-otp";
import { sendOtpTemplate } from "@/lib/auth/otp-whatsapp";

function argTo() {
  const i = process.argv.indexOf("--to");
  const raw = i !== -1 ? process.argv[i + 1] : undefined;
  return (raw ?? "919288487841").replace(/\D/g, "");
}
const TO = argTo();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`); }
};

async function main() {
  const uri = process.env.MONGODB_URI || "";
  const db = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] || "";
  if (!/smoke|test/i.test(db)) {
    console.error(`\n✖ MONGODB_URI must be a throwaway test DB (got "${db}"). Refusing.\n`);
    process.exit(1);
  }
  if (!process.env.ZENITHCODE_API_KEY) {
    console.error("\n✖ ZENITHCODE_API_KEY not set — cannot test the Zenith path.\n");
    process.exit(1);
  }
  await connectDB();
  const conn = mongoose.connection.db!;
  console.log(`\n▶ Zenith multi-variable smoke\n  to:      ${TO}\n  provider: zenith\n  test DB: ${mongoose.connection.name}\n`);

  try {
    // ── A. dealer_approved end-to-end via notifyDealer → real msg + logged "zenith"
    console.log("dealer_approved (notifyDealer → WhatsAppSendLog):");
    const dealerId = new mongoose.Types.ObjectId();
    await conn.collection("dealers").insertOne({
      _id: dealerId, name: "Sujit", businessName: "ZZ Zenith Test", phone: TO,
      status: "active", verificationTier: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    await notifyDealer({
      event: "dealer_approved", dealerId: String(dealerId), dealerName: "Sujit",
      dealerPhone: TO, entityId: String(dealerId),
    });
    const row = await conn.collection("whatsappsendlogs").findOne({ event: "dealer_approved", entityId: String(dealerId) });
    ck("WhatsAppSendLog row written", !!row);
    ck('provider === "zenith" (NOT meta_fallback/meta)', row?.provider === "zenith", row?.provider);
    ck("delivered === true", row?.delivered === true, row?.delivered);
    await sleep(3000);

    // ── B. listing_approved (2 var + URL button) + listing_rejected (3 var) ──────
    console.log("\nlisting_approved (2 var + button) + listing_rejected (3 var):");
    const la = await sendBusinessTemplate(TO, "listing_approved", {
      dealerName: "Sujit", listingTitle: "2 BHK in Baner", listingSlug: "2-bhk-flat-baner-xyz",
    });
    ck("listing_approved delivered via zenith", la.delivered === true && la.via === "zenith", { delivered: la.delivered, via: la.via, error: la.error });
    await sleep(3000);
    const lr = await sendBusinessTemplate(TO, "listing_rejected", {
      dealerName: "Sujit", listingTitle: "2 BHK in Baner", reason: "Photos unclear",
    });
    ck("listing_rejected delivered via zenith", lr.delivered === true && lr.via === "zenith", { delivered: lr.delivered, via: lr.via, error: lr.error });
    await sleep(3000);

    // ── C. button-missing guard → clean internal error, NO upstream call ─────────
    console.log("\nURL-button guard (empty slug):");
    const bad = await sendBusinessTemplate(TO, "listing_approved", {
      dealerName: "Sujit", listingTitle: "2 BHK", listingSlug: "   ",
    });
    ck("not delivered", bad.delivered === false, bad.delivered);
    ck("clean internal error (no blind upstream call)", /requires a URL button/i.test(String(bad.error)), bad.error);

    // ── D. variable-count mismatch is a CLEAN error at the contract too ──────────
    // (low-level call bypasses our guard to document Zenith's own rejection)
    console.log("\nvariable-count mismatch (contract-level):");
    const mismatch = await sendZenithBusinessTemplate(TO, {
      template: "dealer_approved", language: "en", bodyParams: ["a", "b", "c"], // expects 1
    });
    ck("mismatch rejected, not a silent success", mismatch.ok === false, { status: mismatch.status });
    console.log(`     Zenith said: ${(mismatch.error ?? "") + " " + (mismatch.bodyText ?? "")}`.trim().slice(0, 200));

    // ── E. OTP regression — still works via the same provider ────────────────────
    console.log("\nOTP regression:");
    const otp = await sendOtpTemplate(TO, "123456");
    ck("OTP send ok", otp.ok === true, { ok: otp.ok, error: otp.error });
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) {
      await conn.dropDatabase();
      console.log("\n  (test DB dropped)");
    }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\n✖ smoke crashed:", e?.message ?? e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
