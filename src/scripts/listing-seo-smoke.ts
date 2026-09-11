/**
 * Real-HTTP smoke for Feature A: admin listing edit (SEO fields), slug-change
 * 301 redirects, duplicate-slug guard, audit trail, and the listing_updated
 * dealer notification. Runs against a live server on a THROWAWAY test DB
 * (WhatsApp unconfigured, so the notification attempt fails gracefully).
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { ADMIN_COOKIE } from "@/lib/auth/cookie";

const BASE = process.env.BASE ?? "http://localhost:3100";
let pass = 0, fail = 0;
const ck = (n: string, c: boolean, extra?: unknown) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.error(`  ✖ ${n}${extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`); }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const uri = process.env.MONGODB_URI ?? "";
  const dbn = uri.replace(/^mongodb(\+srv)?:\/\//i, "").split("/")[1]?.split("?")[0] ?? "";
  if (!/smoke|test/i.test(dbn)) { console.error(`\n✖ MONGODB_URI must be a test DB (got "${dbn}").\n`); process.exit(1); }
  await connectDB();
  const db = mongoose.connection.db!;
  const oid = () => new mongoose.Types.ObjectId();
  const adminCookie = `${ADMIN_COOKIE}=${await signSession({ role: "admin", adminId: "seo-admin@test" })}`;

  const stateA = oid(), cityA = oid(), locA = oid(), dealer = oid(), l1 = oid(), l2 = oid();
  const now = new Date();
  const s1 = "zz-seo-original", s2 = "zz-seo-other";

  const call = async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const r = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j as { success?: boolean; data?: unknown; error?: { code?: string } } };
  };
  const listingDoc = (id: mongoose.Types.ObjectId, slug: string, title: string) => ({
    _id: id, dealerId: dealer, stateId: stateA, cityId: cityA, localityId: locA,
    status: "approved", purpose: "sale", propertyType: "flat", title, slug,
    lat: 23.36, lng: 85.33, expectedPrice: 5000000,
    description: "A well presented listing with a full description that comfortably clears the hundred character minimum requirement.",
    photos: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "a", width: 1200, height: 900 }],
    coverPhotoIndex: 0, lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 30 * 864e5), createdAt: now, updatedAt: now,
  });

  try {
    try { await fetch(`${BASE}/api/locations/states`); }
    catch { console.error(`✖ No server at ${BASE}.\n`); return; }

    await db.collection("states").insertOne({ _id: stateA, name: "ZZ St", slug: "zz-seo-st", createdAt: now });
    await db.collection("cities").insertOne({ _id: cityA, name: "ZZ City", slug: "zz-seo-city", stateId: stateA, isActive: true, createdAt: now });
    await db.collection("localities").insertOne({ _id: locA, name: "ZZ Loc", slug: "zz-seo-loc", cityId: cityA, stateId: stateA, status: "approved", isActive: true, introText: "x".repeat(600), createdAt: now });
    await db.collection("dealers").insertOne({ _id: dealer, name: "ZZ Dealer", businessName: "ZZ Realty", phone: "919000000088", status: "active", verificationTier: 1, createdAt: now });
    await db.collection("listings").insertMany([listingDoc(l1, s1, "ZZ Original Title"), listingDoc(l2, s2, "ZZ Other Listing")]);

    // ── SEO field edit ──────────────────────────────────────────────────────────
    console.log("SEO fields:");
    const edit = await call(`/api/admin/listings/${l1}`, { method: "PATCH", body: {
      title: "ZZ Updated Premium Title",
      description: "An improved, keyword-rich description that also comfortably exceeds the one hundred character minimum for listings.",
      metaTitle: "ZZ Meta Title",
      metaDescription: "ZZ meta description for search engines.",
    } });
    ck("edit → 200", edit.status === 200, edit.body);
    const changed = (edit.body.data as { changed?: string[] })?.changed ?? [];
    ck("reports changed fields", ["title", "description", "metaTitle", "metaDescription"].every((f) => changed.includes(f)), changed);
    const l1a = await db.collection("listings").findOne({ _id: l1 });
    ck("title saved", l1a?.title === "ZZ Updated Premium Title", l1a?.title);
    ck("metaTitle saved", l1a?.metaTitle === "ZZ Meta Title", l1a?.metaTitle);
    ck("metaDescription saved", l1a?.metaDescription === "ZZ meta description for search engines.");

    // ── Audit trail ───────────────────────────────────────────────────────────
    console.log("\nAudit trail:");
    const hist = await call(`/api/admin/listings/${l1}/history`);
    const entries = (hist.body.data as { by: string; changes: Record<string, { from: string; to: string }> }[]) ?? [];
    ck("history has an entry", entries.length >= 1, entries.length);
    ck("entry records actor + title before/after", entries[0]?.by === "seo-admin@test" && entries[0]?.changes?.title?.to === "ZZ Updated Premium Title", entries[0]);

    // ── Dealer notification attempt (unconfigured → delivered:false, action safe) ─
    console.log("\nDealer notification:");
    let logRow: Record<string, unknown> | null = null;
    for (let i = 0; i < 20 && !logRow; i++) {
      logRow = await db.collection("whatsappsendlogs").findOne({ event: "listing_updated", entityId: String(l1) });
      if (!logRow) await sleep(400);
    }
    ck("listing_updated notification attempted + logged", !!logRow, logRow?.event);
    ck("send failed (WhatsApp unconfigured) but edit still committed", logRow?.delivered === false, logRow?.delivered);

    // ── Slug change + 301 ───────────────────────────────────────────────────────
    console.log("\nSlug change + 301:");
    const newSlug = "zz-seo-renamed";
    const slugEdit = await call(`/api/admin/listings/${l1}`, { method: "PATCH", body: { slug: newSlug } });
    ck("slug change → 200", slugEdit.status === 200, slugEdit.body);
    const l1b = await db.collection("listings").findOne({ _id: l1 });
    ck("slug updated", l1b?.slug === newSlug, l1b?.slug);
    ck("old slug pushed to previousSlugs", (l1b?.previousSlugs as string[] | undefined)?.includes(s1) === true, l1b?.previousSlugs);

    const oldPage = await fetch(`${BASE}/property/${s1}`, { redirect: "manual" });
    const loc = oldPage.headers.get("location") ?? "";
    ck("old slug → permanent redirect (3xx) to new slug", oldPage.status >= 300 && oldPage.status < 400 && loc.includes(newSlug), { status: oldPage.status, loc });
    const newPage = await fetch(`${BASE}/property/${newSlug}`);
    ck("new slug → 200", newPage.status === 200, newPage.status);

    // ── Duplicate slug guard ────────────────────────────────────────────────────
    console.log("\nDuplicate slug:");
    const dup = await call(`/api/admin/listings/${l1}`, { method: "PATCH", body: { slug: s2 } });
    ck("slug = another listing's slug → 409 DUPLICATE", dup.status === 409 && dup.body.error?.code === "DUPLICATE", { status: dup.status, code: dup.body.error?.code });
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) { await db.dropDatabase(); console.log("\n  (test DB dropped)"); }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("\n✖ crashed:", e?.message ?? e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
