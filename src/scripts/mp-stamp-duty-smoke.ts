/**
 * Real-HTTP smoke for the area-wise model going live via Madhya Pradesh.
 * Runs against a live server on a THROWAWAY test DB (the lead endpoint writes).
 *
 * Checks:
 *   - /tools/stamp-duty/madhya-pradesh -> 200, shows urban 8.5% + rural 6.5%,
 *     the area-selector hint, FAQ + FAQPage JSON-LD, the MPIGR portal link
 *   - server compute varies by AREA: urban 8.5% vs rural 6.5%, no women concession
 *   - Bihar (gender-wise) still works and shows NO area selector (regression)
 *   - goa still gated; sitemap lists MP
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { USER_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";
let pass = 0, fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`); }
};

interface LeadOutput { stampDutyPct: number; stampDuty: number; registrationPct: number; registration: number; rebate: number; }

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbn = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] ?? "";
  if (!/smoke|test/i.test(dbn)) { console.error(`\n✖ MONGODB_URI must be a test DB (got "${dbn}").\n`); process.exit(1); }
  await connectDB();
  const db = mongoose.connection.db!;
  const userId = new mongoose.Types.ObjectId();
  const cookie = `${USER_COOKIE}=${await signSession({ role: "user", userId: String(userId) })}`;

  const lead = async (input: unknown) => {
    const r = await fetch(`${BASE}/api/tools/lead`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ tool: "stamp_duty", input }),
    });
    const j = (await r.json().catch(() => ({}))) as { data?: { output?: LeadOutput }; error?: { code?: string } };
    return { status: r.status, output: j.data?.output, body: j };
  };
  const mp = (areaType: "urban" | "rural", buyerType: "male" | "female") =>
    ({ stateSlug: "madhya-pradesh", propertyValue: 10_000_000, propertyType: "residential", areaType, buyerType });

  try {
    try { await fetch(`${BASE}/api/locations/states`); }
    catch { console.error(`✖ No server at ${BASE}.\n`); return; }

    await db.collection("users").insertOne({ _id: userId, phone: "919000000044", phoneVerified: true, name: "Smoke Buyer", createdAt: new Date() });

    // ── 1. MP page ────────────────────────────────────────────────────────────
    console.log("MP page:");
    const page = await fetch(`${BASE}/tools/stamp-duty/madhya-pradesh`);
    const html = await page.text();
    ck("/tools/stamp-duty/madhya-pradesh → 200", page.status === 200, page.status);
    ck("shows urban 8.5%", html.includes("8.5"), true);
    ck("shows rural 6.5%", html.includes("6.5"), true);
    ck("mentions urban & rural", /urban/i.test(html) && /rural/i.test(html), true);
    ck("shows the area-selector hint", html.includes("charges more in urban"), true);
    ck("FAQPage JSON-LD present", html.includes('"FAQPage"'), true);
    ck("links the official MPIGR portal", html.includes("mpigr.gov.in"), true);
    ck("no longer shows 'coming soon' for MP in the picker", !/Madhya Pradesh\s*—\s*coming soon/.test(html), true);

    // ── 2. Area-wise server compute (₹1 crore) ────────────────────────────────
    console.log("\nArea-wise compute (₹1,00,00,000):");
    const urban = await lead(mp("urban", "male"));
    ck("urban lead → 200", urban.status === 200, urban.body);
    ck("urban stamp duty 8.5%", urban.output?.stampDutyPct === 8.5, urban.output?.stampDutyPct);
    ck("urban stamp = ₹8,50,000", urban.output?.stampDuty === 850000, urban.output?.stampDuty);
    ck("urban registration 3% = ₹3,00,000", urban.output?.registration === 300000, urban.output?.registration);

    const rural = await lead(mp("rural", "male"));
    ck("rural stamp duty 6.5%", rural.output?.stampDutyPct === 6.5, rural.output?.stampDutyPct);
    ck("rural stamp = ₹6,50,000", rural.output?.stampDuty === 650000, rural.output?.stampDuty);

    const urbanFemale = await lead(mp("urban", "female"));
    ck("MP female == male (no women concession)", urbanFemale.output?.stampDutyPct === 8.5 && urbanFemale.output?.rebate === 0, urbanFemale.output);

    // ── 3. Bihar regression (gender-wise, NO area selector) ───────────────────
    console.log("\nBihar regression:");
    const bihar = await fetch(`${BASE}/tools/stamp-duty/bihar`);
    const bhtml = await bihar.text();
    ck("Bihar page still 200", bihar.status === 200, bihar.status);
    ck("Bihar still shows 5.7% women's rate", bhtml.includes("5.7"), true);
    ck("Bihar shows NO area-selector hint (area doesn't vary)", !bhtml.includes("charges more in urban"), true);
    const bLead = await lead({ stateSlug: "bihar", propertyValue: 5_000_000, propertyType: "residential", areaType: "urban", buyerType: "female" });
    ck("Bihar female compute still 5.7%", bLead.output?.stampDutyPct === 5.7, bLead.output?.stampDutyPct);

    // ── 4. Goa still gated; sitemap lists MP ──────────────────────────────────
    console.log("\nGating + sitemap:");
    const goa = await lead({ stateSlug: "goa", propertyValue: 5_000_000, propertyType: "residential", areaType: "urban", buyerType: "male" });
    ck("goa still rejected (coming soon)", goa.status !== 200 && goa.body.error?.code === "VALIDATION_ERROR", { status: goa.status, code: goa.body.error?.code });
    const sm = await fetch(`${BASE}/sitemap/static.xml`);
    const xml = await sm.text();
    ck("sitemap lists /tools/stamp-duty/madhya-pradesh", xml.includes("/tools/stamp-duty/madhya-pradesh"), true);
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) { await db.dropDatabase(); console.log("\n  (test DB dropped)"); }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("\n✖ crashed:", e?.message ?? e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
