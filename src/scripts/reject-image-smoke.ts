/**
 * Real-HTTP smoke for Part 1 (relaxed images) + Part 2 (structured reject).
 * Runs against a live server on a THROWAWAY test DB.
 *
 *   - a 1-photo listing passes submit validation (resubmit path);
 *   - a low-res photo (400px) is tagged for admin, NOT shown to buyers;
 *   - reject with empty reasons+note → 422;
 *   - reasons + note → correct joined string, stored UNTRUNCATED in the DB;
 *   - a >200-char reason is stored in full (WhatsApp truncation is unit-tested);
 *   - a rejected listing edits + resubmits → pending;
 *   - admin queue exposes photoCount / minResolution / hasLowRes.
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, ADMIN_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";
let pass = 0, fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`); }
};

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbn = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] ?? "";
  if (!/smoke|test/i.test(dbn)) { console.error(`\n✖ MONGODB_URI must be a test DB (got "${dbn}").\n`); process.exit(1); }
  await connectDB();
  const db = mongoose.connection.db!;
  const oid = () => new mongoose.Types.ObjectId();

  const stateA = oid(), cityA = oid(), locA = oid(), dealer = oid(), listing = oid();
  const now = new Date();
  const adminCookie = `${ADMIN_COOKIE}=${await signSession({ role: "admin", adminId: "smoke" })}`;
  const dealerCookie = `${DEALER_COOKIE}=${await signSession({ role: "dealer", dealerId: String(dealer) })}`;

  const call = async (path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.cookie) headers["Cookie"] = opts.cookie;
    const r = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j as { success?: boolean; data?: unknown; error?: { code?: string } } };
  };
  const getListing = () => db.collection("listings").findOne({ _id: listing });
  const setStatus = (s: string) => db.collection("listings").updateOne({ _id: listing }, { $set: { status: s } });

  try {
    try { await fetch(`${BASE}/api/locations/states`); }
    catch { console.error(`✖ No server at ${BASE}.\n`); return; }

    await db.collection("states").insertOne({ _id: stateA, name: "ZZ St", slug: "zz-st", createdAt: now });
    await db.collection("cities").insertOne({ _id: cityA, name: "ZZ City", slug: "zz-city-img", stateId: stateA, isActive: true, createdAt: now });
    await db.collection("localities").insertOne({ _id: locA, name: "ZZ Loc", slug: "zz-loc-img", cityId: cityA, stateId: stateA, status: "approved", isActive: true, introText: "x".repeat(600), createdAt: now });
    await db.collection("dealers").insertOne({ _id: dealer, name: "ZZ Dealer", businessName: "ZZ Realty", phone: "919000000077", status: "active", verificationTier: 1, createdAt: now });
    // A PENDING listing with exactly ONE, low-resolution (400x300) photo.
    await db.collection("listings").insertOne({
      _id: listing, dealerId: dealer, stateId: stateA, cityId: cityA, localityId: locA,
      status: "pending", purpose: "sale", propertyType: "flat", title: "ZZ One-Photo Listing",
      slug: "zz-one-photo", lat: 23.36, lng: 85.33, expectedPrice: 5000000,
      description:
        "A compact one-photo listing used to prove the relaxed image rules end to end. " +
        "It carries a description well over one hundred characters so the submit validator is satisfied.",
      photos: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 400, height: 300, isLowResolution: true }],
      coverPhotoIndex: 0, lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 30 * 864e5), createdAt: now, updatedAt: now,
    });

    // ── Admin queue: photoCount / minResolution / low-res flag ──────────────────
    console.log("Admin queue signals:");
    const queue = await call(`/api/admin/listings?status=pending`, { cookie: adminCookie });
    const rows = ((queue.body.data as { items?: { _id: string; photoCount: number; minResolution: number | null; hasLowRes: boolean }[] })?.items) ?? [];
    const row = rows.find((r) => r._id === String(listing));
    ck("listing present in pending queue", !!row, rows.length);
    ck("photoCount = 1", row?.photoCount === 1, row?.photoCount);
    ck("minResolution = 300 (shorter side)", row?.minResolution === 300, row?.minResolution);
    ck("hasLowRes = true", row?.hasLowRes === true, row?.hasLowRes);

    // ── Reject validation ───────────────────────────────────────────────────────
    console.log("\nReject flow:");
    const empty = await call(`/api/admin/listings/${listing}/reject`, { method: "POST", cookie: adminCookie, body: {} });
    ck("empty reject → 422", empty.status === 422, empty.status);

    const rej = await call(`/api/admin/listings/${listing}/reject`, { method: "POST", cookie: adminCookie, body: { reasons: ["unclear_photos", "duplicate"], note: "blurry" } });
    ck("structured reject → 200", rej.status === 200, rej.body);
    const afterReject = await getListing();
    ck(
      "DB reason = joined labels + note (untruncated)",
      afterReject?.rejectionReason === "Photos are unclear or low quality, Duplicate listing — blurry",
      afterReject?.rejectionReason,
    );
    ck("status = rejected", afterReject?.status === "rejected", afterReject?.status);

    // >200-char reason stored in full
    await setStatus("pending");
    const longNote = "This is a deliberately long admin note that repeats guidance ".repeat(6);
    const rejLong = await call(`/api/admin/listings/${listing}/reject`, { method: "POST", cookie: adminCookie, body: { reasons: ["unclear_photos", "photos_mismatch", "not_enough_photos", "price_incorrect"], note: longNote } });
    ck("long reject → 200", rejLong.status === 200, rejLong.status);
    const afterLong = await getListing();
    ck("full reason stored untruncated (>200 chars)", (afterLong?.rejectionReason?.length ?? 0) > 200, afterLong?.rejectionReason?.length);

    // ── Dealer resubmit: rejected → edit/submit → pending (1 photo is valid) ─────
    console.log("\nDealer resubmit:");
    const resubmit = await call(`/api/listings/${listing}`, { method: "PATCH", cookie: dealerCookie, body: { submit: true } });
    ck("dealer resubmit → 200 (1-photo listing passes submit)", resubmit.status === 200, resubmit.body);
    const afterResubmit = await getListing();
    ck("rejected → pending after resubmit", afterResubmit?.status === "pending", afterResubmit?.status);

    // ── Buyer never sees the low-res tag ────────────────────────────────────────
    console.log("\nBuyer view:");
    await db.collection("listings").updateOne({ _id: listing }, { $set: { status: "approved" } });
    const page = await fetch(`${BASE}/property/zz-one-photo`);
    const html = page.status === 200 ? await page.text() : "";
    ck(
      "property page does not show any low-res tag to buyers",
      !/low\s*-?\s*res/i.test(html),
      { pageStatus: page.status },
    );
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) { await db.dropDatabase(); console.log("\n  (test DB dropped)"); }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("\n✖ crashed:", e?.message ?? e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
