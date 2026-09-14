/**
 * Real-HTTP smoke for the EXPIRY-cron ISR revalidation. Production (next start)
 * server on a THROWAWAY test DB — dev has no ISR cache so it would prove nothing.
 *
 * The bug: an expired listing's /property/<slug> kept serving the STALE live 200
 * from the ISR cache. An expired listing should instead redirect (308) to its
 * locality page (Section 9). This proves the cron now invalidates that cache.
 *
 * Flow:
 *   1. seed an ACTIVE city + locality + Tier-1 dealer + an APPROVED listing
 *   2. GET /property/<slug>       -> 200 live (PRIMES the ISR cache)
 *   3. force expiresAt into the past, POST /api/cron/expiry (Bearer)
 *   4. GET /property/<slug>       -> 308 redirect to /<city>/<locality> (fix)
 *   5. POST /api/cron/expiry again -> expired === 0 (no-op, no revalidate churn)
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";

const BASE = process.env.BASE ?? "http://localhost:3100";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
let pass = 0,
  fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) {
    pass++;
    console.log(`  ✓ ${n}`);
  } else {
    fail++;
    console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`);
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string): Promise<{ status: number; loc: string | null; body: string }> {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location"), body: await r.text().catch(() => "") };
}
async function runCron(): Promise<{ status: number; expired: number }> {
  const r = await fetch(`${BASE}/api/cron/expiry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const j = (await r.json().catch(() => ({}))) as { data?: { expired?: number } };
  return { status: r.status, expired: j.data?.expired ?? -1 };
}

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbn = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] ?? "";
  if (!/smoke|test/i.test(dbn)) {
    console.error(`\n✖ MONGODB_URI must be a test DB (got "${dbn}").\n`);
    process.exit(1);
  }
  if (!CRON_SECRET) {
    console.error("\n✖ CRON_SECRET not set in this process — cannot call the cron.\n");
    process.exit(1);
  }
  await connectDB();
  const db = mongoose.connection.db!;
  const oid = () => new mongoose.Types.ObjectId();
  const now = new Date();

  const stateA = oid(), cityA = oid(), locA = oid(), dealer = oid(), listing = oid();
  const citySlug = "zz-exp-city";
  const localitySlug = "zz-exp-loc";
  const slug = "zz-exp-flat-25-lakh-ex9q2z";

  try {
    try {
      await fetch(`${BASE}/api/locations/states`);
    } catch {
      console.error(`✖ No server at ${BASE}.\n`);
      return;
    }

    // ── Seed: an APPROVED listing that is currently live (future expiresAt) ─────
    await db.collection("states").insertOne({ _id: stateA, name: "ZZ St", slug: "zz-exp-st", createdAt: now });
    await db.collection("cities").insertOne({ _id: cityA, name: "ZZ Exp City", slug: citySlug, stateId: stateA, isActive: true, createdAt: now });
    await db.collection("localities").insertOne({ _id: locA, name: "ZZ Exp Loc", slug: localitySlug, cityId: cityA, stateId: stateA, status: "approved", isActive: true, introText: "x".repeat(600), createdAt: now });
    await db.collection("dealers").insertOne({ _id: dealer, name: "ZZ Dealer", businessName: "ZZ Realty", phone: "919000000066", status: "active", verificationTier: 1, createdAt: now });
    await db.collection("listings").insertOne({
      _id: listing, dealerId: dealer, purpose: "sale", propertyType: "flat",
      title: "ZZ Expiry Test Flat", slug, status: "approved",
      description: "A complete description for the expiry revalidation smoke that comfortably clears the one hundred character minimum required on submit.",
      stateId: stateA, cityId: cityA, localityId: locA,
      lat: 23.36, lng: 85.33, location: { type: "Point", coordinates: [85.33, 23.36] },
      expectedPrice: 2500000,
      photos: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 1200, height: 900 }],
      coverPhotoIndex: 0,
      lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 10 * 864e5), // live: +10 days
      createdAt: now, updatedAt: now,
    });

    // ── 1. Live detail primes a cached 200 ────────────────────────────────────
    console.log("Before expiry:");
    const before = await get(`/property/${slug}`);
    ck("live listing → /property/<slug> 200 (primes ISR cache)", before.status === 200, before.status);
    ck("renders the listing", /ZZ Expiry Test Flat/.test(before.body), before.body.length);

    // ── 2. Force it overdue, run the cron ─────────────────────────────────────
    console.log("\nExpire (cron):");
    await db.collection("listings").updateOne(
      { _id: listing },
      { $set: { expiresAt: new Date(now.getTime() - 864e5) } }, // yesterday
    );
    const cron = await runCron();
    ck("cron → 200", cron.status === 200, cron.status);
    ck("cron reports expired >= 1", cron.expired >= 1, cron.expired);

    // ── 3. Detail page must flip immediately: no longer the stale live 200 ─────
    await sleep(700);
    let after = await get(`/property/${slug}`);
    if (after.status === 200) { await sleep(1200); after = await get(`/property/${slug}`); }
    ck("expired listing → NOT the stale live 200", after.status !== 200, after.status);
    ck(
      "expired listing → 308 redirect to its locality page (cache invalidated)",
      after.status >= 300 && after.status < 400 && (after.loc ?? "").includes(`/${citySlug}/${localitySlug}`),
      { status: after.status, loc: after.loc },
    );

    // ── 4. Second run: nothing overdue → expired 0 (no revalidate call fires) ──
    console.log("\nNo-op run:");
    const cron2 = await runCron();
    ck("second cron run → 200", cron2.status === 200, cron2.status);
    ck("nothing expired the 2nd time → expired === 0", cron2.expired === 0, cron2.expired);
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) {
      await db.dropDatabase();
      console.log("\n  (test DB dropped)");
    }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\n✖ crashed:", e?.message ?? e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
