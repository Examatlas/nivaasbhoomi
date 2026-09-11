/**
 * Real-HTTP security smoke for Feature B: staff accounts with scoped access.
 *
 * Proves the non-negotiables against a LIVE server on a THROWAWAY test DB:
 *   - staff sees ONLY dealers they onboarded (∪ approved access requests)
 *   - a dealer id outside scope returns 404 (never leaks existence), even in the
 *     URL — GET, and create-listing for that dealer
 *   - staff verify changes the dealer's tier
 *   - staff publishes a listing that goes LIVE directly (status approved)
 *   - access request → admin approve → the dealer becomes visible
 *   - 10-pending access-request rate limit
 *   - deactivating a staff kills its live session IMMEDIATELY (tokenVersion bump)
 *
 * All scope is derived server-side from the session; the client only ever sends
 * ids in the URL/body, which the server re-checks.
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE, STAFF_COOKIE } from "@/lib/auth/cookie";

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

  const staffId = oid();
  const otherStaffId = oid();
  const stateA = oid(),
    cityA = oid(),
    locA = oid();
  const dealerA = oid(); // onboarded by our staff — in scope
  const dealerB = oid(); // onboarded by another staff — out of scope
  const rateDealers = Array.from({ length: 11 }, () => oid()); // for the rate-limit test

  // Cookies (staff cookie carries tv:0, matching the inserted Staff record).
  const adminCookie = `${ADMIN_COOKIE}=${await signSession({ role: "admin", adminId: "staff-smoke-admin@test" })}`;
  const staffCookie = `${STAFF_COOKIE}=${await signSession({ role: "staff", staffId: String(staffId), tv: 0 })}`;

  const call = async (
    path: string,
    opts: { method?: string; body?: unknown; cookie?: string } = {},
  ) => {
    const r = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", Cookie: opts.cookie ?? staffCookie },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    return {
      status: r.status,
      body: j as { success?: boolean; data?: unknown; error?: { code?: string } },
    };
  };

  const listingPayload = (dealerId: mongoose.Types.ObjectId) => ({
    dealerId: String(dealerId),
    purpose: "sale",
    propertyType: "flat",
    title: "ZZ Staff Published Flat",
    description:
      "A clean, well-lit two bedroom flat published directly by staff. This description comfortably clears the one hundred character minimum required by the listing schema.",
    stateId: String(stateA),
    cityId: String(cityA),
    localityId: String(locA),
    lat: 23.36,
    lng: 85.33,
    expectedPrice: 5_000_000,
    photos: [
      { url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 1200, height: 900 },
    ],
    coverPhotoIndex: 0,
  });

  try {
    try {
      await fetch(`${BASE}/api/locations/states`);
    } catch {
      console.error(`✖ No server at ${BASE}.\n`);
      return;
    }

    // ── Seed ────────────────────────────────────────────────────────────────
    await db.collection("states").insertOne({ _id: stateA, name: "ZZ St", slug: "zz-staff-st", createdAt: now });
    await db.collection("cities").insertOne({ _id: cityA, name: "ZZ City", slug: "zz-staff-city", stateId: stateA, isActive: true, createdAt: now });
    await db.collection("localities").insertOne({ _id: locA, name: "ZZ Loc", slug: "zz-staff-loc", cityId: cityA, stateId: stateA, status: "approved", isActive: true, introText: "x".repeat(600), createdAt: now });
    await db.collection("staffs").insertMany([
      { _id: staffId, name: "Scoped Staff", email: "scoped.staff@test", passwordHash: "x", status: "active", tokenVersion: 0, createdBy: "admin@test", createdAt: now },
      { _id: otherStaffId, name: "Other Staff", email: "other.staff@test", passwordHash: "x", status: "active", tokenVersion: 0, createdBy: "admin@test", createdAt: now },
    ]);
    await db.collection("dealers").insertMany([
      { _id: dealerA, name: "Dealer A", businessName: "A Realty", phone: "919000000001", status: "active", verificationTier: 0, onboardedBy: staffId, createdAt: now },
      { _id: dealerB, name: "Dealer B", businessName: "B Realty", phone: "919000000002", status: "active", verificationTier: 0, onboardedBy: otherStaffId, createdAt: now },
      ...rateDealers.map((id, i) => ({ _id: id, name: `Rate ${i}`, businessName: `Rate ${i} Realty`, phone: `9190000100${String(i).padStart(2, "0")}`, status: "active", verificationTier: 0, onboardedBy: otherStaffId, createdAt: now })),
    ]);

    // ── Scope: only own dealers ───────────────────────────────────────────────
    console.log("Scope (server-derived):");
    const list = await call("/api/staff/dealers");
    const listIds = ((list.body.data as { _id: string }[]) ?? []).map((d) => d._id);
    ck("list → 200", list.status === 200, list.body);
    ck("sees dealerA (onboarded by self)", listIds.includes(String(dealerA)), listIds);
    ck("does NOT see dealerB (another staff's)", !listIds.includes(String(dealerB)), listIds);

    // ── Cross-dealer id in URL → 404 (no leak) ────────────────────────────────
    console.log("\nCross-dealer id → 404 (no leak):");
    const getB = await call(`/api/staff/dealers/${dealerB}`);
    ck("GET out-of-scope dealer → 404", getB.status === 404, { status: getB.status });
    ck("404 body carries no dealer data", getB.body.data === undefined, getB.body.data);
    const publishB = await call("/api/staff/listings", { method: "POST", body: listingPayload(dealerB) });
    ck("publish for out-of-scope dealer → 404", publishB.status === 404, { status: publishB.status });

    // ── Verify dealerA → tier changes ─────────────────────────────────────────
    console.log("\nVerify (tier recompute):");
    const verify = await call(`/api/staff/dealers/${dealerA}/verify`, { method: "POST", body: { pan: true, aadhaar: true } });
    ck("verify → 200", verify.status === 200, verify.body);
    ck("pan+aadhaar verified → Tier 1", (verify.body.data as { verificationTier?: number })?.verificationTier === 1, verify.body.data);

    // ── Publish for dealerA → goes live directly ──────────────────────────────
    console.log("\nStaff publish (direct-live):");
    const publishA = await call("/api/staff/listings", { method: "POST", body: listingPayload(dealerA) });
    ck("publish for in-scope dealer → 200", publishA.status === 200, publishA.body);
    ck("listing status = approved (live, no admin approval)", (publishA.body.data as { status?: string })?.status === "approved", publishA.body.data);
    const publishedSlug = (publishA.body.data as { slug?: string })?.slug;
    if (publishedSlug) {
      const live = await fetch(`${BASE}/property/${publishedSlug}`);
      ck("published listing is reachable at its public URL", live.status === 200, live.status);
    }

    // ── Access request → admin approve → visible ──────────────────────────────
    console.log("\nAccess request → admin approve:");
    const reqB = await call("/api/staff/access-requests", { method: "POST", body: { dealerId: String(dealerB), reason: "Colleague on leave" } });
    ck("request access to dealerB → 200 pending", reqB.status === 200 && (reqB.body.data as { status?: string })?.status === "pending", reqB.body);
    const reqId = (reqB.body.data as { _id?: string })?._id;
    const approve = await call(`/api/admin/access-requests/${reqId}`, { method: "PATCH", body: { action: "approve" }, cookie: adminCookie });
    ck("admin approve → 200", approve.status === 200, approve.body);
    const list2 = await call("/api/staff/dealers");
    const list2Ids = ((list2.body.data as { _id: string }[]) ?? []).map((d) => d._id);
    ck("dealerB now visible (granted)", list2Ids.includes(String(dealerB)), list2Ids);
    const getB2 = await call(`/api/staff/dealers/${dealerB}`);
    ck("GET dealerB now → 200", getB2.status === 200, getB2.status);

    // ── Rate limit: 10 pending max ────────────────────────────────────────────
    console.log("\nAccess-request rate limit (10 pending):");
    let okCount = 0;
    for (let i = 0; i < 10; i++) {
      const r = await call("/api/staff/access-requests", { method: "POST", body: { dealerId: String(rateDealers[i]) } });
      if (r.status === 200) okCount++;
    }
    ck("first 10 pending requests accepted", okCount === 10, okCount);
    const eleventh = await call("/api/staff/access-requests", { method: "POST", body: { dealerId: String(rateDealers[10]) } });
    ck("11th request → RATE_LIMITED", eleventh.status !== 200 && eleventh.body.error?.code === "RATE_LIMITED", { status: eleventh.status, code: eleventh.body.error?.code });

    // ── Deactivate → session dies immediately ─────────────────────────────────
    console.log("\nDeactivation kills the live session immediately:");
    const before = await call("/api/staff/dealers");
    ck("session works before deactivation", before.status === 200, before.status);
    const deact = await call(`/api/admin/staff/${staffId}`, { method: "PATCH", body: { action: "deactivate" }, cookie: adminCookie });
    ck("admin deactivate → 200", deact.status === 200, deact.body);
    const after = await call("/api/staff/dealers"); // SAME (now-stale) staff cookie
    ck("same cookie now rejected → 401 (tokenVersion bumped)", after.status === 401, { status: after.status });
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
