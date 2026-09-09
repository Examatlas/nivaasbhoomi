/**
 * Real-HTTP smoke test for Phase 1 dealer lifecycle WhatsApp notifications.
 *
 * Drives the actual admin routes over HTTP (approve / reject / verify) against a
 * running dev server on a THROWAWAY test DB, and asserts:
 *   - admin action completes even when the WhatsApp send fails (best-effort,
 *     no rollback) — the server here runs with WhatsApp UNCONFIGURED, so every
 *     send resolves delivered:false;
 *   - each event writes the right WhatsAppSendLog row (event + entityId);
 *   - a missing/invalid dealer phone → skip + logged, no crash;
 *   - 24h dedup: a prior DELIVERED row suppresses a repeat send.
 *
 * Auth: mints a real admin JWT with JWT_SECRET (same secret the server uses).
 *
 *   # 1. .env.local must have AGENT_SMOKE_TEST_MONGODB_URI (throwaway DB)
 *   # 2. start an isolated server on the test DB with WhatsApp unconfigured
 *   #    (see the harness in the task; BASE defaults to http://localhost:3100)
 *   # 3. npx tsx src/scripts/dealer-notify-smoke.ts
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { signSession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✖ ${name}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`);
  }
}

function dbNameOf(uri: string): string {
  const a = uri.replace(/^mongodb(\+srv)?:\/\//i, "");
  const s = a.indexOf("/");
  return s === -1 ? "" : (a.slice(s + 1).split(/[?]/)[0] ?? "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const uri = process.env.AGENT_SMOKE_TEST_MONGODB_URI?.trim();
  if (!uri || !/^mongodb(\+srv)?:\/\//i.test(uri)) {
    console.error("\n✖ AGENT_SMOKE_TEST_MONGODB_URI not set / invalid — refusing (never prod).\n");
    process.exit(1);
  }
  const db = dbNameOf(uri);
  if (!/smoke|test/i.test(db)) {
    console.error(`\n✖ Refusing: "${db}" is not a test database.\n`);
    process.exit(1);
  }

  await mongoose.connect(uri, { bufferCommands: false, autoIndex: false, serverSelectionTimeoutMS: 8000 });
  const conn = mongoose.connection.db!;
  console.log(`\n▶ Dealer-notify smoke\n  server:  ${BASE}\n  test DB: ${mongoose.connection.name}\n`);

  // Admin session cookie (real JWT, same secret as the server).
  let cookie: string;
  try {
    const token = await signSession({ role: "admin", adminId: "smoke-admin" });
    cookie = `${ADMIN_COOKIE}=${token}`;
  } catch (e) {
    console.error("✖ Could not mint admin JWT (JWT_SECRET missing?):", (e as Error).message);
    await mongoose.disconnect();
    process.exit(1);
  }

  const oid = () => new mongoose.Types.ObjectId();
  const cityId = oid();
  const localityId = oid();
  const stateId = oid();
  const dOwner = oid(); // verified (tier 1) owner of the listings
  const dVerify = oid(); // tier 0 → verified in-test (dealer_approved, valid phone)
  const dNoPhone = oid(); // tier 0 → verified, but invalid phone (skip path)
  const L1 = oid();
  const L2 = oid();

  async function call(path: string, body?: unknown) {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await r.json().catch(() => ({}))) as { success?: boolean; error?: { code?: string } };
    return { status: r.status, json };
  }

  /** Poll WhatsAppSendLog for a row matching event+entityId. */
  async function waitForLog(event: string, entityId: string, ms = 10000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const row = await conn.collection("whatsappsendlogs").findOne({ event, entityId });
      if (row) return row;
      await sleep(400);
    }
    return null;
  }

  try {
    // preflight: server up + on the test DB?
    try {
      await fetch(`${BASE}/api/admin/notifications/status?entityId=x`, { headers: { Cookie: cookie } });
    } catch {
      console.error(`✖ No server at ${BASE}. Start the isolated test-DB server first.\n`);
      return;
    }

    const now = new Date();
    const docs = { pan: { url: "x", verified: false }, aadhaar: { url: "x", verified: false } };
    await conn.collection("dealers").insertMany([
      { _id: dOwner, name: "Owner Dealer", businessName: "ZZ Owner", phone: "919876500001", status: "active", verificationTier: 1, createdAt: now, updatedAt: now },
      { _id: dVerify, name: "Verify Dealer", businessName: "ZZ Verify", phone: "919876500002", status: "active", verificationTier: 0, documents: docs, createdAt: now, updatedAt: now },
      { _id: dNoPhone, name: "NoPhone Dealer", businessName: "ZZ NoPhone", phone: "12345", status: "active", verificationTier: 0, documents: docs, createdAt: now, updatedAt: now },
    ]);
    await conn.collection("cities").insertOne({ _id: cityId, name: "ZZ City", slug: "zz-notify-city", createdAt: now, updatedAt: now });
    await conn.collection("localities").insertOne({ _id: localityId, cityId, name: "ZZ Loc", slug: "zz-notify-loc", createdAt: now, updatedAt: now });
    const listing = (id: mongoose.Types.ObjectId, slug: string, title: string) => ({
      _id: id, dealerId: dOwner, stateId, cityId, localityId, status: "pending",
      purpose: "sale", propertyType: "flat", title, slug, lat: 23.36, lng: 85.33,
      expectedPrice: 5000000,
      description:
        "A well-maintained 2 BHK flat in a quiet, well-connected neighbourhood, close to schools, " +
        "markets and public transport. Ideal for a small family looking to move in immediately.",
      lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      photos: [
        { url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 1200, height: 900 },
        { url: "https://res.cloudinary.com/demo/image/upload/b.jpg", publicId: "b", width: 1200, height: 900 },
        { url: "https://res.cloudinary.com/demo/image/upload/c.jpg", publicId: "c", width: 1200, height: 900 },
      ],
      coverPhotoIndex: 0,
      createdAt: now, updatedAt: now,
    });
    await conn.collection("listings").insertMany([
      listing(L1, "zz-notify-l1", "ZZ Notify L1"),
      listing(L2, "zz-notify-l2", "ZZ Notify L2"),
    ]);

    // ── 1. listing_approved: admin action completes though the send fails ──────
    console.log("listing_approved:");
    const ap = await call(`/api/admin/listings/${L1}/approve`);
    check("approve → 200", ap.status === 200, ap.json);
    const l1 = await conn.collection("listings").findOne({ _id: L1 });
    check("listing is approved (admin action committed)", l1?.status === "approved", l1?.status);
    const apLog = await waitForLog("listing_approved", String(L1));
    check("WhatsAppSendLog row written for listing_approved", Boolean(apLog));
    check("send failed (WhatsApp unconfigured) yet action stuck", apLog?.delivered === false, apLog?.delivered);
    check("log carries dealerId", String(apLog?.dealerId) === String(dOwner), apLog?.dealerId);

    // ── 2. listing_rejected (reason with newlines) ─────────────────────────────
    console.log("\nlisting_rejected:");
    const rj = await call(`/api/admin/listings/${L1}/reject`, { reason: "Photos unclear.\nPlease reshoot.\n\n— Admin" });
    check("reject → 200", rj.status === 200, rj.json);
    const l1b = await conn.collection("listings").findOne({ _id: L1 });
    check("listing is rejected (admin action committed)", l1b?.status === "rejected", l1b?.status);
    check("rejectionReason stored", typeof l1b?.rejectionReason === "string" && l1b.rejectionReason.length > 0);
    check("WhatsAppSendLog row for listing_rejected", Boolean(await waitForLog("listing_rejected", String(L1))));

    // ── 3. dealer_approved (Tier 0 → verified) ─────────────────────────────────
    console.log("\ndealer_approved:");
    const vf = await call(`/api/admin/dealers/${dVerify}/verify`, { pan: true, aadhaar: true });
    check("verify → 200", vf.status === 200, vf.json);
    const dv = await conn.collection("dealers").findOne({ _id: dVerify });
    check("dealer is now Tier ≥1 (admin action committed)", (dv?.verificationTier ?? 0) >= 1, dv?.verificationTier);
    check("WhatsAppSendLog row for dealer_approved", Boolean(await waitForLog("dealer_approved", String(dVerify))));

    // ── 4. invalid phone → skip + log, action still completes ──────────────────
    console.log("\ninvalid phone skip:");
    const vf2 = await call(`/api/admin/dealers/${dNoPhone}/verify`, { pan: true, aadhaar: true });
    check("verify (bad phone dealer) → 200", vf2.status === 200, vf2.json);
    const dnp = await conn.collection("dealers").findOne({ _id: dNoPhone });
    check("dealer verified despite unsendable phone", (dnp?.verificationTier ?? 0) >= 1, dnp?.verificationTier);
    const skipLog = await waitForLog("dealer_approved", String(dNoPhone));
    check("skip logged (delivered:false)", skipLog?.delivered === false, skipLog?.delivered);
    check("skip reason mentions phone", /phone/i.test(String(skipLog?.error)), skipLog?.error);

    // ── 5. 24h dedup: a prior DELIVERED row suppresses the repeat ──────────────
    console.log("\ndedup (24h):");
    await conn.collection("whatsappsendlogs").insertOne({
      provider: "meta", template: "listing_approved", delivered: true,
      event: "listing_approved", entityId: String(L2), dealerId: dOwner, createdAt: new Date(),
    });
    const ap2 = await call(`/api/admin/listings/${L2}/approve`);
    check("approve L2 → 200 (action still completes under dedup)", ap2.status === 200, ap2.json);
    check("L2 approved", (await conn.collection("listings").findOne({ _id: L2 }))?.status === "approved");
    await sleep(3500); // give any (wrongly) queued send time to write
    const l2Count = await conn.collection("whatsappsendlogs").countDocuments({ event: "listing_approved", entityId: String(L2) });
    check("dedup held — no second row for L2", l2Count === 1, l2Count);
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) {
      await conn.dropDatabase();
      console.log("\n  (test DB dropped)");
    }
    await mongoose.disconnect();
  }

  console.log(`\n${failed === 0 ? "✓" : "✖"} ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\n✖ Smoke crashed:", err?.message ?? err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
