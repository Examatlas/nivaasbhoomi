/**
 * Real-HTTP smoke for the LocationPicker backend + Farm House type.
 *
 * Exercises the live routes against a running server on a THROWAWAY test DB:
 *   - locality search: by name (ranked, prefix-first), by pincode, min-2-chars,
 *     no-match, id-lookup, limit, city-scoping;
 *   - locality request: create, dedup (same name in city), rate-limit (5/day);
 *   - admin approve: a pending locality becomes searchable only after approval;
 *   - farmhouse: agent search filters on type=farmhouse and returns it.
 *
 * Auth: mints dealer + admin JWTs with JWT_SECRET (same secret the server uses).
 *
 *   $env:MONGODB_URI=$env:AGENT_SMOKE_TEST_MONGODB_URI
 *   npx tsx src/scripts/location-farmhouse-smoke.ts        # BASE defaults 3100
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, ADMIN_COOKIE } from "@/lib/auth/cookie";
import { generateAgentKey } from "@/lib/agent/key";

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

  const dealerCookie = `${DEALER_COOKIE}=${await signSession({ role: "dealer", dealerId: "" })}`;
  const adminCookie = `${ADMIN_COOKIE}=${await signSession({ role: "admin", adminId: "smoke" })}`;

  const stateA = oid(), cityA = oid(), cityB = oid(), dealer = oid();
  const agentKey = generateAgentKey();
  const banerId = oid(), balewadiId = oid(), bavdhanId = oid(), kharadiId = oid();
  const farmListing = oid(), flatListing = oid();
  const now = new Date();

  // dealer cookie needs the real dealerId — re-sign now that we have it.
  const dealerCookieReal = `${DEALER_COOKIE}=${await signSession({ role: "dealer", dealerId: String(dealer) })}`;

  const call = async (path: string, opts: { method?: string; body?: unknown; cookie?: string; key?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.cookie) headers["Cookie"] = opts.cookie;
    if (opts.key) headers["X-Agent-Key"] = opts.key;
    const r = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j as { success?: boolean; data?: unknown; error?: { code?: string } } };
  };
  const data = <T,>(r: { body: { data?: unknown } }) => r.body.data as T;

  try {
    void dealerCookie;
    // Server up?
    try { await fetch(`${BASE}/api/locations/localities?cityId=${cityA}`); }
    catch { console.error(`✖ No server at ${BASE}.\n`); return; }

    // ── Fixtures ────────────────────────────────────────────────────────────
    await db.collection("states").insertOne({ _id: stateA, name: "ZZ State", slug: "zz-state", createdAt: now });
    await db.collection("cities").insertMany([
      { _id: cityA, name: "ZZ City A", slug: "zz-city-a", stateId: stateA, createdAt: now },
      { _id: cityB, name: "ZZ City B", slug: "zz-city-b", stateId: stateA, createdAt: now },
    ]);
    const loc = (id: mongoose.Types.ObjectId, name: string, slug: string, pincodes: string[], cityId = cityA) =>
      ({ _id: id, name, slug, cityId, stateId: stateA, pincodes, status: "approved", isActive: true, createdAt: now });
    await db.collection("localities").insertMany([
      loc(banerId, "Baner", "baner", ["411045"]),
      loc(balewadiId, "Balewadi", "balewadi", ["411045"]),
      loc(bavdhanId, "Bavdhan", "bavdhan", ["411021"]),
      loc(kharadiId, "Kharadi", "kharadi", ["411014"]),
      loc(oid(), "Baner", "baner-cityb", ["999999"], cityB), // same name, other city
    ]);
    await db.collection("dealers").insertOne({
      _id: dealer, name: "ZZ Dealer", businessName: "ZZ Realty", phone: "919000000055", status: "active",
      verificationTier: 1, agentApiKeyHash: agentKey.hash, agentApiKeyLast4: agentKey.last4, createdAt: now,
    });
    const listing = (id: mongoose.Types.ObjectId, type: string, title: string, slug: string) =>
      ({ _id: id, dealerId: dealer, stateId: stateA, cityId: cityA, localityId: banerId, status: "approved",
         purpose: "sale", propertyType: type, title, slug, expectedPrice: 5000000, isSeed: false,
         description: "x".repeat(120), lastRefreshedAt: now, expiresAt: new Date(now.getTime() + 30 * 864e5),
         photos: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg" }], createdAt: now, updatedAt: now });
    await db.collection("listings").insertMany([
      listing(farmListing, "farmhouse", "ZZ Farm House", "zz-farm"),
      listing(flatListing, "flat", "ZZ Flat", "zz-flat"),
    ]);

    // ── Locality search ───────────────────────────────────────────────────────
    console.log("Locality search:");
    const byName = data<{ _id: string; name: string }[]>(await call(`/api/locations/localities?cityId=${cityA}&q=ba`));
    const names = byName.map((l) => l.name);
    ck("q='ba' returns Baner/Balewadi/Bavdhan", ["Baner", "Balewadi", "Bavdhan"].every((n) => names.includes(n)), names);
    ck("q='ba' excludes Kharadi", !names.includes("Kharadi"), names);
    ck("prefix ranked first (all 'ba*' alphabetical → Balewadi,Baner,Bavdhan)", byName[0]?.name === "Balewadi", names);

    const byPin = data<{ name: string }[]>(await call(`/api/locations/localities?cityId=${cityA}&q=411045`));
    const pinNames = byPin.map((l) => l.name).sort();
    ck("pincode '411045' → Baner + Balewadi", pinNames.join(",") === "Balewadi,Baner", pinNames);

    const oneChar = data<unknown[]>(await call(`/api/locations/localities?cityId=${cityA}&q=b`));
    ck("q='b' (1 char) → empty", oneChar.length === 0, oneChar.length);

    const noMatch = data<unknown[]>(await call(`/api/locations/localities?cityId=${cityA}&q=zzqqxx`));
    ck("no-match query → empty", noMatch.length === 0);

    const byIdRes = data<{ _id: string; name: string }[]>(await call(`/api/locations/localities?cityId=${cityA}&id=${banerId}`));
    ck("id lookup → single Baner", byIdRes.length === 1 && byIdRes[0]?.name === "Baner", byIdRes);

    const limited = data<unknown[]>(await call(`/api/locations/localities?cityId=${cityA}&q=ba&limit=1`));
    ck("limit=1 caps results", limited.length === 1, limited.length);

    const scoped = data<{ name: string }[]>(await call(`/api/locations/localities?cityId=${cityB}&q=baner`));
    ck("city scoping: cityB 'baner' returns only cityB's", scoped.length === 1, scoped.map((l) => l.name));

    // ── Locality request (dealer) ──────────────────────────────────────────────
    console.log("\nLocality request:");
    const req1 = await call("/api/locations/locality-request", { method: "POST", cookie: dealerCookieReal, body: { cityId: String(cityA), name: "Testnagar", pincode: "411099" } });
    const req1Id = data<{ localityId: string; existing: boolean }>(req1);
    ck("create request → 200", req1.status === 200, req1.body);
    ck("created (existing:false)", req1Id.existing === false, req1Id);

    const dedup = data<{ localityId: string; existing: boolean }>(await call("/api/locations/locality-request", { method: "POST", cookie: dealerCookieReal, body: { cityId: String(cityA), name: "testNAGAR", pincode: "411099" } }));
    ck("dedup same name (case-insensitive) → existing:true, same id", dedup.existing === true && dedup.localityId === req1Id.localityId, dedup);

    // pending locality NOT in search yet
    const preApprove = data<unknown[]>(await call(`/api/locations/localities?cityId=${cityA}&q=testnagar`));
    ck("pending locality NOT in search", preApprove.length === 0, preApprove.length);

    // rate limit: 1 created so far; create 4 more (=5), 6th → 429
    for (let i = 2; i <= 5; i++) {
      await call("/api/locations/locality-request", { method: "POST", cookie: dealerCookieReal, body: { cityId: String(cityA), name: `Ratenagar ${i}` } });
    }
    const sixth = await call("/api/locations/locality-request", { method: "POST", cookie: dealerCookieReal, body: { cityId: String(cityA), name: "Ratenagar 6" } });
    ck("6th request in a day → 429 RATE_LIMITED", sixth.status === 429 && sixth.body.error?.code === "RATE_LIMITED", { status: sixth.status, code: sixth.body.error?.code });

    // ── Admin approve ───────────────────────────────────────────────────────────
    console.log("\nAdmin approve:");
    const approve = await call(`/api/admin/locations/localities/${req1Id.localityId}/approve`, { method: "POST", cookie: adminCookie });
    ck("admin approve → 200", approve.status === 200, approve.body);
    const postApprove = data<{ name: string }[]>(await call(`/api/locations/localities?cityId=${cityA}&q=testnagar`));
    ck("approved locality now appears in search", postApprove.some((l) => l.name === "Testnagar"), postApprove);

    // ── Farmhouse in search ─────────────────────────────────────────────────────
    console.log("\nFarm House type:");
    const farmSearch = data<{ items: { id: string; type: string }[] }>(await call(`/api/agent/search?type=farmhouse`, { key: agentKey.plaintext }));
    const farmIds = (farmSearch.items ?? []).map((i) => i.id);
    ck("agent search type=farmhouse returns the farmhouse listing", farmIds.includes(String(farmListing)), farmIds);
    ck("...and excludes the flat", !farmIds.includes(String(flatListing)), farmIds);
    const flatSearch = data<{ items: { id: string }[] }>(await call(`/api/agent/search?type=flat`, { key: agentKey.plaintext }));
    ck("agent search type=flat returns the flat, not the farmhouse", (flatSearch.items ?? []).some((i) => i.id === String(flatListing)) && !(flatSearch.items ?? []).some((i) => i.id === String(farmListing)));
  } finally {
    if (/smoke|test/i.test(mongoose.connection.name)) { await db.dropDatabase(); console.log("\n  (test DB dropped)"); }
    await mongoose.disconnect();
  }

  console.log(`\n${fail === 0 ? "✓" : "✖"} ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("\n✖ crashed:", e?.message ?? e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
