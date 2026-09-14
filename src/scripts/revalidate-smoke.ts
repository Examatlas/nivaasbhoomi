/**
 * Real-HTTP smoke for the ISR revalidation fix. Runs against a PRODUCTION
 * (next start) server on a THROWAWAY test DB, because revalidatePath only has an
 * effect where the full-route ISR cache is active (dev renders fresh every time,
 * so it would prove nothing).
 *
 * Flow:
 *   1. seed an ACTIVE city + locality + Tier-1 dealer + a PENDING listing
 *   2. GET /property/<slug>  -> 404 (pending) — this PRIMES the ISR 404 cache
 *   3. POST /approve         -> 200
 *   4. GET /property/<slug>  -> 200 immediately (the fix: cache invalidated)
 *   5. GET /<citySlug>       -> the card now appears
 *   6. POST /reject          -> 200
 *   7. GET /property/<slug>  -> 404 again (unpublish invalidates too)
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";
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

async function getStatus(path: string): Promise<{ status: number; body: string }> {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text().catch(() => "") };
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
  const oid = () => new mongoose.Types.ObjectId();
  const now = new Date();

  const stateA = oid(), cityA = oid(), locA = oid(), dealer = oid(), listing = oid();
  const citySlug = "zz-reval-city";
  const localitySlug = "zz-reval-loc";
  const slug = "zz-reval-flat-varanasi-25-lakh-rv1x9q";
  const adminCookie = `${ADMIN_COOKIE}=${await signSession({ role: "admin", adminId: "reval-admin@test" })}`;

  const call = async (path: string, method = "POST", body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j as { success?: boolean; error?: { code?: string } } };
  };

  try {
    try {
      await fetch(`${BASE}/api/locations/states`);
    } catch {
      console.error(`✖ No server at ${BASE}.\n`);
      return;
    }

    // ── Seed ──────────────────────────────────────────────────────────────────
    await db.collection("states").insertOne({ _id: stateA, name: "ZZ St", slug: "zz-reval-st", createdAt: now });
    await db.collection("cities").insertOne({ _id: cityA, name: "ZZ Reval City", slug: citySlug, stateId: stateA, isActive: true, createdAt: now });
    await db.collection("localities").insertOne({ _id: locA, name: "ZZ Reval Loc", slug: localitySlug, cityId: cityA, stateId: stateA, status: "approved", isActive: true, introText: "x".repeat(600), createdAt: now });
    await db.collection("dealers").insertOne({ _id: dealer, name: "ZZ Dealer", businessName: "ZZ Realty", phone: "919000000077", status: "active", verificationTier: 1, createdAt: now });
    await db.collection("listings").insertOne({
      _id: listing, dealerId: dealer, purpose: "sale", propertyType: "flat",
      title: "ZZ Revalidate Test Flat", slug, status: "pending",
      description: "A complete description for the revalidation smoke test that comfortably clears the one hundred character minimum required on submit.",
      stateId: stateA, cityId: cityA, localityId: locA,
      lat: 23.36, lng: 85.33, location: { type: "Point", coordinates: [85.33, 23.36] },
      expectedPrice: 2500000,
      photos: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 1200, height: 900 }],
      coverPhotoIndex: 0, lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 30 * 864e5),
      createdAt: now, updatedAt: now,
    });

    // ── 1. Pending detail primes a cached 404 ─────────────────────────────────
    console.log("Before approve:");
    const before = await getStatus(`/property/${slug}`);
    ck("pending listing → /property/<slug> 404 (primes ISR cache)", before.status === 404, before.status);

    // ── 2. Approve → should invalidate the cached 404 ─────────────────────────
    console.log("\nApprove:");
    const approve = await call(`/api/admin/listings/${listing}/approve`);
    ck("approve → 200", approve.status === 200, approve.body);

    // The revalidatePath is awaited in the handler; a tiny settle window covers
    // the store write before the next request reads it.
    await sleep(600);
    let after1 = await getStatus(`/property/${slug}`);
    if (after1.status !== 200) { await sleep(1200); after1 = await getStatus(`/property/${slug}`); }
    ck("approved listing → /property/<slug> 200 IMMEDIATELY (fix)", after1.status === 200, after1.status);
    ck("detail page actually renders the listing", /ZZ Revalidate Test Flat/.test(after1.body), after1.body.length);

    // ── 3. City page card shows up ────────────────────────────────────────────
    console.log("\nCity page:");
    await sleep(300);
    let city = await getStatus(`/${citySlug}`);
    if (!city.body.includes(slug)) { await sleep(1200); city = await getStatus(`/${citySlug}`); }
    ck("city page → 200", city.status === 200, city.status);
    ck("city page shows the new listing card", city.body.includes(slug), city.body.includes(`/property/${slug}`));

    // ── 4. Reject (unpublish) → detail 404s again ─────────────────────────────
    console.log("\nReject (unpublish):");
    const reject = await call(`/api/admin/listings/${listing}/reject`, "POST", { reasons: [], note: "smoke unpublish" });
    ck("reject → 200", reject.status === 200, reject.body);
    await sleep(600);
    let after2 = await getStatus(`/property/${slug}`);
    if (after2.status === 200) { await sleep(1200); after2 = await getStatus(`/property/${slug}`); }
    ck("rejected listing → /property/<slug> 404 again (unpublish invalidates)", after2.status === 404, after2.status);
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
