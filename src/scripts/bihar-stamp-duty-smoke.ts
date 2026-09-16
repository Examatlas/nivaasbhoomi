/**
 * Real-HTTP smoke for the Bihar stamp-duty tool going live. Runs against a live
 * server on a THROWAWAY test DB (the lead endpoint writes a lead).
 *
 * Checks:
 *   - /tools/stamp-duty/bihar  -> 200, shows verified rates + FAQ + FAQPage JSON-LD
 *   - server-side compute via /api/tools/lead: female 5.7% (with rebate) vs male 6%
 *   - /sitemap/static.xml includes the Bihar page
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { USER_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";
let pass = 0,
  fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`); }
};

interface LeadOutput {
  stampDutyPct: number;
  stampDuty: number;
  registrationPct: number;
  registration: number;
  totalAdditional: number;
  rebate: number;
  stateName: string;
}

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbn = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] ?? "";
  if (!/smoke|test/i.test(dbn)) {
    console.error(`\n✖ MONGODB_URI must be a test DB (got "${dbn}").\n`);
    process.exit(1);
  }
  await connectDB();
  const db = mongoose.connection.db!;
  const userId = new mongoose.Types.ObjectId();
  const cookie = `${USER_COOKIE}=${await signSession({ role: "user", userId: String(userId) })}`;

  const lead = async (input: unknown) => {
    const r = await fetch(`${BASE}/api/tools/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ tool: "stamp_duty", input }),
    });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: { output?: LeadOutput }; error?: { code?: string } };
    return { status: r.status, output: j.data?.output, body: j };
  };
  const baseInput = { stateSlug: "bihar", propertyValue: 5_000_000, propertyType: "residential", areaType: "urban" };

  try {
    try { await fetch(`${BASE}/api/locations/states`); }
    catch { console.error(`✖ No server at ${BASE}.\n`); return; }

    await db.collection("users").insertOne({
      _id: userId, phone: "919000000055", phoneVerified: true, name: "Smoke Buyer", createdAt: new Date(),
    });

    // ── 1. Page renders with verified rates ──────────────────────────────────
    console.log("Bihar page:");
    const page = await fetch(`${BASE}/tools/stamp-duty/bihar`);
    const html = await page.text();
    ck("/tools/stamp-duty/bihar → 200", page.status === 200, page.status);
    ck("shows the 5.7% women's rate", html.includes("5.7"), html.includes("5.7"));
    ck("shows the 6% general rate", /\b6%|6 %|about 6/.test(html), true);
    ck("mentions registration charges", /registration charges/i.test(html), true);
    ck("FAQPage JSON-LD present", html.includes('"FAQPage"'), html.includes('"FAQPage"'));
    ck("links the official nibandhan portal", html.includes("nibandhan.bihar.gov.in"), true);
    ck("has an 'other states' cross-link", html.includes("Stamp duty in other states"), true);

    // ── 2. Gender-wise server compute (the lead endpoint) ─────────────────────
    console.log("\nServer-side compute (₹50,00,000):");
    const female = await lead({ ...baseInput, buyerType: "female" });
    ck("female lead → 200", female.status === 200, female.body);
    ck("female stamp duty 5.7%", female.output?.stampDutyPct === 5.7, female.output?.stampDutyPct);
    ck("female stamp = ₹2,85,000", female.output?.stampDuty === 285000, female.output?.stampDuty);
    ck("registration 2% = ₹1,00,000", female.output?.registration === 100000, female.output?.registration);
    ck("women's rebate = ₹15,000 (vs 6%)", female.output?.rebate === 15000, female.output?.rebate);

    const male = await lead({ ...baseInput, buyerType: "male" });
    ck("male stamp duty 6%", male.output?.stampDutyPct === 6, male.output?.stampDutyPct);
    ck("male stamp = ₹3,00,000", male.output?.stampDuty === 300000, male.output?.stampDuty);
    ck("male has no rebate", male.output?.rebate === 0, male.output?.rebate);

    const joint = await lead({ ...baseInput, buyerType: "joint" });
    ck("joint stamp duty 6% (any other case)", joint.output?.stampDutyPct === 6, joint.output?.stampDutyPct);

    // ── 3. MP still refused (no verified rate) ────────────────────────────────
    console.log("\nMP still gated:");
    const mp = await lead({ ...baseInput, stateSlug: "madhya-pradesh", buyerType: "male" });
    ck("MP lead → rejected (coming soon)", mp.status !== 200 && mp.body.error?.code === "VALIDATION_ERROR", { status: mp.status, code: mp.body.error?.code });

    // ── 4. Sitemap includes the Bihar page ───────────────────────────────────
    console.log("\nSitemap:");
    const sm = await fetch(`${BASE}/sitemap/static.xml`);
    const xml = await sm.text();
    ck("/sitemap/static.xml → 200", sm.status === 200, sm.status);
    ck("sitemap lists /tools/stamp-duty/bihar", xml.includes("/tools/stamp-duty/bihar"), true);
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) { await db.dropDatabase(); console.log("\n  (test DB dropped)"); }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("\n✖ crashed:", e?.message ?? e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
