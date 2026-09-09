/**
 * Real-HTTP smoke test for the Dealer-scoped Agent Data API (P3).
 *
 * Unlike the pure unit tests (key/rate-limit), this exercises the LIVE routes
 * over real HTTP against a running dev server, proving the security guarantees
 * end-to-end:
 *   - a dealer's key sees ONLY that dealer's approved, non-seed listings
 *   - cross-dealer listingId  → empty (no data leak)
 *   - seed listing            → never in search, lead attempt → 422
 *   - missing key 401 · invalid key 401 · inactive dealer 403 · rate limit 429
 *   - lead create → a real Lead row (source "whatsapp_agent", assigned to A)
 *   - dedup (24h) → the second identical enquiry returns the same leadId
 *
 * It creates its own namespaced fixtures (native inserts, so it bypasses model
 * validation and touches nothing else) and DELETES them all in a finally block.
 *
 * ── NEVER runs against production ──────────────────────────────────────────
 * It connects ONLY to AGENT_SMOKE_TEST_MONGODB_URI (a throwaway test database).
 * If that var is unset it exits immediately — there is NO fallback to
 * MONGODB_URI. It also refuses to run if the resolved URI looks like a
 * production database (name contains prod/production/live) or matches the app's
 * own MONGODB_URI from .env.local.
 *
 * Because the running server reads the fixtures, the server MUST use the SAME
 * test database. Run both against the test URI:
 *
 *   # 1. add to .env.local:  AGENT_SMOKE_TEST_MONGODB_URI="mongodb+srv://…/nb_smoke_test"
 *   # 2. start the server on the test DB (PowerShell), in one terminal:
 *   $env:MONGODB_URI=$env:AGENT_SMOKE_TEST_MONGODB_URI; npm run dev
 *   #    (or set MONGODB_URI=<the test URI> for that shell)
 *   # 3. in a second terminal, run the smoke test:
 *   npx tsx src/scripts/agent-api-smoke.ts
 *   #    (BASE defaults to http://localhost:3000; override with $env:BASE)
 */
import "@/scripts/load-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

import { hashAgentKey, generateAgentKey } from "@/lib/agent/key";

const BASE = process.env.BASE ?? "http://localhost:3000";
const TAG = "ZZ_AGENT_SMOKE"; // marks every fixture so cleanup is exact

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

/** Database name from a mongodb URI — the path segment after the authority. */
function dbNameOf(uri: string): string {
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, "");
  const slash = afterScheme.indexOf("/");
  if (slash === -1) return "";
  return afterScheme.slice(slash + 1).split(/[?]/)[0] ?? "";
}

/** Read a single var straight from .env.local (raw, override-proof). */
function readEnvLocal(key: string): string | null {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1 || t.slice(0, eq).trim() !== key) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {
    /* no .env.local — fine */
  }
  return null;
}

/**
 * Resolve the test URI and refuse anything that could be production.
 * Exits the process on any violation (never returns a prod URI).
 */
function resolveTestUri(): string {
  const uri = process.env.AGENT_SMOKE_TEST_MONGODB_URI?.trim();
  if (!uri) {
    console.error(
      "\n✖ AGENT_SMOKE_TEST_MONGODB_URI is not set (or didn't load from .env.local).\n" +
        "  This test never runs against the production database. Point it at a\n" +
        "  throwaway test DB and try again, e.g. in .env.local:\n\n" +
        '    AGENT_SMOKE_TEST_MONGODB_URI="mongodb+srv://…/nb_smoke_test"\n',
    );
    process.exit(1);
  }

  // A set-but-not-a-URI value means it failed to load/parse — give a clean
  // message rather than letting the Mongo driver throw a raw "Invalid scheme".
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    console.error(
      "\n✖ AGENT_SMOKE_TEST_MONGODB_URI did not load as a valid MongoDB URI\n" +
        "  (it must start with mongodb:// or mongodb+srv://). Check the line and its\n" +
        "  quoting in .env.local. The value was NOT used.\n",
    );
    process.exit(1);
  }

  const testDb = dbNameOf(uri);
  if (!testDb) {
    console.error("\n✖ AGENT_SMOKE_TEST_MONGODB_URI must name a database (…/<dbname>).\n");
    process.exit(1);
  }

  // Guard 1: an obviously-production database name.
  if (/(^|[^a-z])(prod|production|live)([^a-z]|$)/i.test(testDb)) {
    console.error(`\n✖ Refusing to run: "${testDb}" looks like a production database.\n`);
    process.exit(1);
  }

  // Guard 2: it must not be the app's own MONGODB_URI (read raw from .env.local,
  // so a shell override of MONGODB_URI can't sneak the prod DB past this check).
  const appUri = readEnvLocal("MONGODB_URI") ?? process.env.MONGODB_URI ?? "";
  if (appUri) {
    const appDb = dbNameOf(appUri);
    if (uri.trim() === appUri.trim() || (appDb && appDb.toLowerCase() === testDb.toLowerCase())) {
      console.error(
        `\n✖ Refusing to run: the test URI resolves to the app's own database ("${testDb}").\n` +
          "  Use a SEPARATE, throwaway database for AGENT_SMOKE_TEST_MONGODB_URI.\n",
      );
      process.exit(1);
    }
  }

  return uri;
}

interface Res {
  status: number;
  retryAfter: string | null;
  body: { success?: boolean; data?: unknown; error?: { code?: string; message?: string } };
}

async function call(
  path: string,
  opts: { key?: string; method?: string; body?: unknown } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.key) headers["X-Agent-Key"] = opts.key;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: Res["body"] = {};
  try {
    body = (await r.json()) as Res["body"];
  } catch {
    /* non-JSON */
  }
  return { status: r.status, retryAfter: r.headers.get("Retry-After"), body };
}

async function main() {
  const uri = resolveTestUri();

  await mongoose.connect(uri, { bufferCommands: false, autoIndex: false, serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db!;
  console.log(`\n▶ Agent API smoke test`);
  console.log(`  server:   ${BASE}`);
  console.log(`  test DB:  ${mongoose.connection.name}\n`);
  const oid = () => new mongoose.Types.ObjectId();

  // Make sure the server is actually up before we seed anything.
  try {
    await fetch(`${BASE}/api/agent/search`);
  } catch {
    console.error(`✖ No server at ${BASE}. Start it with \`npm run dev\` (on the test DB) first.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Keys (plaintext only lives here; DB stores the hash) ──────────────────
  const keyA = generateAgentKey().plaintext;
  const keyB = generateAgentKey().plaintext;
  const keyC = generateAgentKey().plaintext; // inactive dealer

  // ── Ids ───────────────────────────────────────────────────────────────────
  const dealerA = oid();
  const dealerB = oid();
  const dealerC = oid();
  const cityId = oid();
  const localityId = oid();
  const listA1 = oid(); // dealer A, approved, non-seed
  const listA2 = oid(); // dealer A, approved, non-seed (for pagination)
  const listASeed = oid(); // dealer A, approved, SEED
  const listB1 = oid(); // dealer B, approved, non-seed

  const now = new Date();
  const smokePhone = "919000000091";
  let aborted = false;

  try {
    // ── Seed fixtures (native inserts bypass mongoose validation) ────────────
    await db.collection("dealers").insertMany([
      dealerDoc(dealerA, "active", hashAgentKey(keyA)),
      dealerDoc(dealerB, "active", hashAgentKey(keyB)),
      dealerDoc(dealerC, "paused", hashAgentKey(keyC)),
    ]);
    await db.collection("cities").insertOne({
      _id: cityId, name: `${TAG} City`, slug: "zz-smoke-city", createdAt: now, updatedAt: now,
    });
    await db.collection("localities").insertOne({
      _id: localityId, cityId, name: `${TAG} Locality`, slug: "zz-smoke-loc", createdAt: now, updatedAt: now,
    });
    await db.collection("listings").insertMany([
      listingDoc(listA1, dealerA, cityId, localityId, { isSeed: false, title: `${TAG} A1`, slug: "zz-smoke-a1", expectedPrice: 5_000_000 }),
      listingDoc(listA2, dealerA, cityId, localityId, { isSeed: false, title: `${TAG} A2`, slug: "zz-smoke-a2", expectedPrice: 7_000_000 }),
      listingDoc(listASeed, dealerA, cityId, localityId, { isSeed: true, title: `${TAG} A-seed`, slug: "zz-smoke-aseed", expectedPrice: 6_000_000 }),
      listingDoc(listB1, dealerB, cityId, localityId, { isSeed: false, title: `${TAG} B1`, slug: "zz-smoke-b1", expectedPrice: 9_000_000 }),
    ]);

    // ── Pre-flight: confirm the SERVER is pointed at this same test DB ────────
    // If it isn't, it can't see the fixtures we just wrote — fail loudly with a
    // clear fix instead of a confusing wall of assertion failures.
    const preflight = await call("/api/agent/search", { key: keyA });
    const pfIds = ((preflight.body.data as { items?: { id: string }[] })?.items ?? []).map((i) => i.id);
    if (!pfIds.includes(String(listA1))) {
      console.error(
        "✖ The server can't see the test fixtures — it is NOT on the test DB.\n" +
          "  Start it on the same database, e.g. (PowerShell):\n" +
          "    $env:MONGODB_URI=$env:AGENT_SMOKE_TEST_MONGODB_URI; npm run dev\n",
      );
      aborted = true;
    }

    if (!aborted) {
      // ── AUTH ───────────────────────────────────────────────────────────────
      console.log("Auth:");
      const noKey = await call("/api/agent/search");
      check("missing key → 401", noKey.status === 401, noKey.status);
      check("missing key → UNAUTHORIZED code", noKey.body.error?.code === "UNAUTHORIZED", noKey.body);

      const badKey = await call("/api/agent/search", { key: "nb_agent_totally-bogus-key" });
      check("invalid key → 401", badKey.status === 401, badKey.status);

      const inactive = await call("/api/agent/search", { key: keyC });
      check("inactive (paused) dealer → 403", inactive.status === 403, inactive.status);
      check("inactive dealer → FORBIDDEN code", inactive.body.error?.code === "FORBIDDEN", inactive.body);

      // ── SEARCH SCOPING ──────────────────────────────────────────────────────
      console.log("\nSearch scoping:");
      const aSearch = await call("/api/agent/search", { key: keyA });
      const aItems = ((aSearch.body.data as { items?: { id: string }[] })?.items) ?? [];
      const aIds = aItems.map((i) => i.id);
      check("key A search → 200", aSearch.status === 200, aSearch.status);
      check("key A sees its own approved listing A1", aIds.includes(String(listA1)), aIds);
      check("key A sees its own approved listing A2", aIds.includes(String(listA2)), aIds);
      check("key A NEVER sees its own SEED listing", !aIds.includes(String(listASeed)), aIds);
      check("key A NEVER sees dealer B's listing", !aIds.includes(String(listB1)), aIds);

      // no buyer PII in any shape
      const shape = aItems[0] as Record<string, unknown> | undefined;
      check("listing shape has publicUrl (absolute www URL)", typeof shape?.publicUrl === "string" && String(shape.publicUrl).startsWith("http"), shape?.publicUrl);
      check("listing shape carries no buyer PII keys", shape !== undefined && !("phone" in shape) && !("buyerPhone" in shape) && !("email" in shape), Object.keys(shape ?? {}));

      // single-listing detail scoping
      const aDetail = await call(`/api/agent/search?listingId=${listA1}`, { key: keyA });
      const aDetailItems = ((aDetail.body.data as { items?: unknown[] })?.items) ?? [];
      check("key A listingId=A1 → single detail", aDetailItems.length === 1, aDetailItems.length);

      const crossDealer = await call(`/api/agent/search?listingId=${listB1}`, { key: keyA });
      const crossItems = ((crossDealer.body.data as { items?: unknown[] })?.items) ?? [];
      check("key A listingId=B1 (cross-dealer) → EMPTY", crossItems.length === 0, crossItems.length);

      const seedDetail = await call(`/api/agent/search?listingId=${listASeed}`, { key: keyA });
      const seedItems = ((seedDetail.body.data as { items?: unknown[] })?.items) ?? [];
      check("key A listingId=A-seed → EMPTY (seed hidden)", seedItems.length === 0, seedItems.length);

      // cursor pagination (limit=1 → nextCursor, page 2 has the other listing)
      const p1 = await call("/api/agent/search?limit=1", { key: keyA });
      const p1data = p1.body.data as { items?: { id: string }[]; nextCursor?: string | null };
      check("limit=1 returns 1 item + nextCursor", (p1data.items?.length === 1) && Boolean(p1data.nextCursor), p1data);
      if (p1data.nextCursor) {
        const p2 = await call(`/api/agent/search?limit=1&cursor=${p1data.nextCursor}`, { key: keyA });
        const p2data = p2.body.data as { items?: { id: string }[] };
        const p1id = p1data.items?.[0]?.id;
        const p2id = p2data.items?.[0]?.id;
        check("cursor page 2 is a different listing", Boolean(p2id) && p2id !== p1id, { p1id, p2id });
      }

      // ── LEAD CREATE ─────────────────────────────────────────────────────────
      console.log("\nLead create:");
      const lead1 = await call("/api/agent/lead", {
        key: keyA, method: "POST",
        body: { name: "Smoke Buyer", phone: "9000000091", listingId: String(listA1), intent: "buy", message: "interested" },
      });
      const lead1data = lead1.body.data as { leadId?: string; deduped?: boolean; assigned?: boolean };
      check("lead create → 200", lead1.status === 200, lead1.status);
      check("lead create → assigned, not deduped", lead1data.assigned === true && lead1data.deduped === false, lead1data);

      // verify the actual Lead row
      let leadRow: Record<string, unknown> | null = null;
      if (lead1data.leadId) {
        leadRow = await db.collection("leads").findOne({ _id: new mongoose.Types.ObjectId(lead1data.leadId) });
      }
      check("Lead row exists", leadRow !== null);
      check("Lead.source === 'whatsapp_agent'", leadRow?.source === "whatsapp_agent", leadRow?.source);
      check("Lead assigned to dealer A", String(leadRow?.assignedDealerId) === String(dealerA), leadRow?.assignedDealerId);
      check("Lead pinned (slaDeadline null)", leadRow?.slaDeadline === null, leadRow?.slaDeadline);
      check("Lead phone normalized to 91XXXXXXXXXX", leadRow?.phone === smokePhone, leadRow?.phone);

      // dedup — identical enquiry within 24h returns the SAME leadId
      const lead2 = await call("/api/agent/lead", {
        key: keyA, method: "POST",
        body: { name: "Smoke Buyer", phone: "9000000091", listingId: String(listA1), intent: "buy" },
      });
      const lead2data = lead2.body.data as { leadId?: string; deduped?: boolean };
      check("2nd identical enquiry → deduped:true", lead2data.deduped === true, lead2data);
      check("2nd enquiry → same leadId", lead2data.leadId === lead1data.leadId, { a: lead1data.leadId, b: lead2data.leadId });

      // seed listing lead → 422
      const seedLead = await call("/api/agent/lead", {
        key: keyA, method: "POST",
        body: { phone: "9000000092", listingId: String(listASeed) },
      });
      check("lead on SEED listing → 422", seedLead.status === 422, seedLead.status);
      check("seed lead → VALIDATION_ERROR code", seedLead.body.error?.code === "VALIDATION_ERROR", seedLead.body);

      // cross-dealer listingId on a lead → still accepted but attached to NO listing
      const crossLead = await call("/api/agent/lead", {
        key: keyA, method: "POST",
        body: { phone: "9000000093", listingId: String(listB1) },
      });
      check("lead with cross-dealer listingId → 200 (listing ignored)", crossLead.status === 200, crossLead.status);
      if ((crossLead.body.data as { leadId?: string })?.leadId) {
        const clRow = await db.collection("leads").findOne({ _id: new mongoose.Types.ObjectId((crossLead.body.data as { leadId: string }).leadId) });
        check("cross-dealer lead has NO listingId attached", clRow?.listingId == null, clRow?.listingId);
        check("cross-dealer lead still assigned to dealer A", String(clRow?.assignedDealerId) === String(dealerA), clRow?.assignedDealerId);
      }

      // ── RATE LIMIT ───────────────────────────────────────────────────────────
      // Deterministic: pre-load 60 log rows in the last minute for dealer A, so the
      // next request trips the 60/min cap without hammering the server 60×.
      console.log("\nRate limit:");
      const bulk = Array.from({ length: 60 }, () => ({
        dealerId: dealerA, endpoint: "search", status: 200, ms: 1, createdAt: new Date(Date.now() - 1000),
      }));
      await db.collection("agentapilogs").insertMany(bulk);
      const limited = await call("/api/agent/search", { key: keyA });
      check("over 60/min → 429", limited.status === 429, limited.status);
      check("429 → RATE_LIMITED code", limited.body.error?.code === "RATE_LIMITED", limited.body);
      check("429 → Retry-After header present", limited.retryAfter === "60", limited.retryAfter);
    }
  } finally {
    // ── Cleanup: remove EVERY fixture + anything the test created ──────────────
    const dealerIds = [dealerA, dealerB, dealerC];
    await Promise.all([
      db.collection("dealers").deleteMany({ _id: { $in: dealerIds } }),
      db.collection("cities").deleteMany({ _id: cityId }),
      db.collection("localities").deleteMany({ _id: localityId }),
      db.collection("listings").deleteMany({ _id: { $in: [listA1, listA2, listASeed, listB1] } }),
      db.collection("leads").deleteMany({ assignedDealerId: { $in: dealerIds } }),
      db.collection("leads").deleteMany({ phone: { $in: [smokePhone, "919000000092", "919000000093"] } }),
      db.collection("conversations").deleteMany({ phone: { $in: [smokePhone, "919000000092", "919000000093"] } }),
      db.collection("agentapilogs").deleteMany({ dealerId: { $in: dealerIds } }),
      db.collection("auditlogs").deleteMany({ dealerId: { $in: dealerIds } }),
    ]);
    console.log("\n  (fixtures cleaned up)");
    await mongoose.disconnect();
  }

  if (aborted) {
    console.log("\n✖ Aborted before assertions (see above).\n");
    process.exit(1);
  }
  console.log(`\n${failed === 0 ? "✓" : "✖"} ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

function dealerDoc(_id: mongoose.Types.ObjectId, status: string, keyHash: string) {
  const now = new Date();
  return {
    _id,
    name: `${TAG} Dealer`,
    businessName: `${TAG} ${String(_id).slice(-4)}`,
    // no phone → sendLeadAssigned no-ops (hermetic, never calls WhatsApp)
    status,
    tier: 1,
    agentApiKeyHash: keyHash,
    agentApiKeyLast4: "test",
    agentApiKeyCreatedAt: now,
    agentApiKeyLastUsedAt: null,
    leadsUsedThisMonth: 0,
    totalLeadsReceived: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function listingDoc(
  _id: mongoose.Types.ObjectId,
  dealerId: mongoose.Types.ObjectId,
  cityId: mongoose.Types.ObjectId,
  localityId: mongoose.Types.ObjectId,
  o: { isSeed: boolean; title: string; slug: string; expectedPrice: number },
) {
  const now = new Date();
  return {
    _id,
    dealerId,
    cityId,
    localityId,
    isSeed: o.isSeed,
    title: o.title,
    slug: o.slug,
    status: "approved",
    purpose: "sale",
    propertyType: "flat",
    bhk: "2",
    carpetArea: 900,
    expectedPrice: o.expectedPrice,
    description: "Smoke-test listing.",
    photos: [{ url: "https://res.cloudinary.com/demo/image/upload/smoke.jpg" }],
    coverPhotoIndex: 0,
    leadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

main().catch(async (err) => {
  console.error("\n✖ Smoke test crashed:", err?.message ?? err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
