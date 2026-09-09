/**
 * Admin: delete a dealer and EVERYTHING that belongs to it — safely.
 *
 * Runs against PROD, so it is defensive:
 *   - dry-run by DEFAULT; nothing is deleted without --confirm;
 *   - it first SHOWS the full blast radius (dealer, linked User, listings, leads,
 *     agent key, WhatsAppSendLog rows, …) and asks you to re-run with --confirm;
 *   - before deleting it writes a COMPLETE EJSON backup of every affected document
 *     to backups/ (timestamped) so a mistake is fully recoverable;
 *   - the cascade is exhaustive so no orphan listings/leads/logs are left behind;
 *   - after deleting it recounts the affected cities' cached counters.
 *
 * Usage (PowerShell):
 *   node scripts/delete-dealer.mjs --id 665f...            # dry run (shows plan)
 *   node scripts/delete-dealer.mjs --name "Asha Realty"   # dry run
 *   node scripts/delete-dealer.mjs --id 665f... --confirm # actually delete
 *
 * Never touches .env.local; MONGODB_URI is read from it (a real env var wins).
 */
import mongoose from "mongoose";
import { EJSON } from "bson";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── env (Node's built-in parser; real env wins, .env.local over .env) ─────────
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(resolve(process.cwd(), f));
  } catch {
    /* optional file */
  }
}

// ── args ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") out.confirm = true;
    else if (a === "--id" || a === "--name") out[a.slice(2)] = argv[++i];
    else if (a.startsWith("--id=")) out.id = a.slice(5);
    else if (a.startsWith("--name=")) out.name = a.slice(7);
  }
  return out;
}

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const { Types } = mongoose;
const oid = (v) => new Types.ObjectId(String(v));

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if ((args.id && args.name) || (!args.id && !args.name)) {
    die("Pass exactly one of --id <dealerId> or --name \"<dealer name>\".");
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) die("MONGODB_URI is not set (checked env, .env.local, .env).");

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const C = (name) => db.collection(name);
  console.log(`\nConnected to database: ${mongoose.connection.name}`);

  // ── resolve the dealer (unambiguously) ───────────────────────────────────────
  let dealer;
  if (args.id) {
    if (!Types.ObjectId.isValid(args.id)) die(`"${args.id}" is not a valid ObjectId.`);
    dealer = await C("dealers").findOne({ _id: oid(args.id) });
    if (!dealer) die(`No dealer with _id ${args.id}.`);
  } else {
    const rx = new RegExp(`^${escapeRegex(args.name.trim())}$`, "i");
    const matches = await C("dealers")
      .find({ $or: [{ name: rx }, { businessName: rx }] })
      .toArray();
    if (matches.length === 0) die(`No dealer whose name/businessName is "${args.name}".`);
    if (matches.length > 1) {
      console.error(`\n✖ "${args.name}" matches ${matches.length} dealers — use --id to disambiguate:\n`);
      for (const d of matches) {
        console.error(`    ${d._id}  ${d.businessName ?? ""} (${d.name ?? ""}) +${d.phone ?? "?"}`);
      }
      process.exit(1);
    }
    dealer = matches[0];
  }

  const dealerId = dealer._id;
  const dIdStr = String(dealerId);

  // ── gather the blast radius (read-only) ──────────────────────────────────────
  const listings = await C("listings").find({ dealerId }, { projection: { _id: 1, cityId: 1, localityId: 1 } }).toArray();
  const listingIds = listings.map((l) => l._id);
  const cityIds = [...new Set(listings.map((l) => l.cityId).filter(Boolean).map(String))];
  // recount must also cover cities the dealer merely covered (dealerCount changes)
  for (const c of dealer.coverageCities ?? []) cityIds.push(String(c));
  const affectedCityIds = [...new Set(cityIds)];

  const leadFilter = {
    $or: [
      { assignedDealerId: dealerId },
      { intendedDealerId: dealerId },
      { "assignmentHistory.dealerId": dealerId },
      ...(listingIds.length ? [{ listingId: { $in: listingIds } }, { otherListingIds: { $in: listingIds } }] : []),
    ],
  };
  const whatsAppFilter = {
    $or: [{ dealerId }, { entityId: { $in: [dIdStr, ...listingIds.map(String)] } }],
  };
  const auditFilter = { $or: [{ dealerId }, { prevDealerId: dealerId }] };
  const listingIdFilter = listingIds.length ? { listingId: { $in: listingIds } } : { _id: null };

  const [
    users, leads, agentLogs, emailTokens, waLogs, auditLogs, reports, savedListings,
  ] = await Promise.all([
    C("users").find({ dealerId }).toArray(),
    C("leads").find(leadFilter).toArray(),
    C("agentapilogs").find({ dealerId }).toArray(),
    C("emailchangetokens").find({ dealerId }).toArray(),
    C("whatsappsendlogs").find(whatsAppFilter).toArray(),
    C("auditlogs").find(auditFilter).toArray(),
    C("listingreports").find(listingIdFilter).toArray(),
    C("savedlistings").find(listingIdFilter).toArray(),
  ]);
  const leadIds = leads.map((l) => l._id);

  // ── show the plan ────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────");
  console.log(" WILL DELETE (cascade):");
  console.log("────────────────────────────────────────────────────────");
  console.log(`  Dealer:            ${dealer.businessName ?? ""} (${dealer.name ?? ""})`);
  console.log(`     _id:            ${dIdStr}`);
  console.log(`     phone:          +${dealer.phone ?? "?"}   status: ${dealer.status ?? "?"}   tier: ${dealer.verificationTier ?? 0}`);
  console.log(`     agent API key:  ${dealer.agentApiKeyHash ? `yes (…${dealer.agentApiKeyLast4 ?? "????"})` : "none"}`);
  console.log(`  Linked User acct:  ${users.length}`);
  console.log(`  Listings:          ${listings.length}`);
  console.log(`  Leads:             ${leads.length}`);
  console.log(`  AgentApiLog rows:  ${agentLogs.length}`);
  console.log(`  EmailChangeToken:  ${emailTokens.length}`);
  console.log(`  WhatsAppSendLog:   ${waLogs.length}`);
  console.log(`  AuditLog rows:     ${auditLogs.length}`);
  console.log(`  ListingReports:    ${reports.length}`);
  console.log(`  SavedListings:     ${savedListings.length}`);
  console.log(`  Cities to recount: ${affectedCityIds.length}`);
  console.log("  Also: Conversation.leadId & SavedSearch.lastSeenListingId pointers to the");
  console.log("        above are cleared (the buyer conversations themselves are kept).");
  console.log("────────────────────────────────────────────────────────");

  if (!args.confirm) {
    console.log("\nDRY RUN — nothing was deleted.");
    console.log(`Re-run with --confirm to delete and back up, e.g.:`);
    console.log(`  node scripts/delete-dealer.mjs --id ${dIdStr} --confirm\n`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── backup EVERYTHING first (EJSON → exact restore) ──────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(process.cwd(), "backups", `dealer-${dIdStr}-${stamp}.json`);
  const backup = {
    meta: { deletedAt: new Date().toISOString(), dealerId: dIdStr, database: mongoose.connection.name },
    dealer,
    users,
    listings: await C("listings").find({ dealerId }).toArray(), // full docs
    leads,
    agentApiLogs: agentLogs,
    emailChangeTokens: emailTokens,
    whatsAppSendLogs: waLogs,
    auditLogs,
    listingReports: reports,
    savedListings,
    affectedCityIds,
  };
  writeFileSync(backupPath, EJSON.stringify(backup, undefined, 2), "utf8");
  console.log(`\n✓ Backup written: ${backupPath}`);

  // ── delete (children first, dealer last) ─────────────────────────────────────
  const del = async (label, coll, filter) => {
    const r = await C(coll).deleteMany(filter);
    console.log(`  - ${label}: ${r.deletedCount}`);
    return r.deletedCount;
  };

  console.log("\nDeleting…");
  if (listingIds.length) {
    await del("listingReports", "listingreports", { listingId: { $in: listingIds } });
    await del("savedListings", "savedlistings", { listingId: { $in: listingIds } });
    const s = await C("savedsearches").updateMany(
      { lastSeenListingId: { $in: listingIds } },
      { $set: { lastSeenListingId: null } },
    );
    console.log(`  ~ savedSearches.lastSeenListingId cleared: ${s.modifiedCount}`);
  }
  if (leadIds.length) {
    const cv = await C("conversations").updateMany(
      { leadId: { $in: leadIds } },
      { $set: { leadId: null } },
    );
    console.log(`  ~ conversations.leadId cleared: ${cv.modifiedCount}`);
  }
  await del("leads", "leads", leadFilter);
  await del("agentApiLogs", "agentapilogs", { dealerId });
  await del("emailChangeTokens", "emailchangetokens", { dealerId });
  await del("whatsAppSendLogs", "whatsappsendlogs", whatsAppFilter);
  await del("auditLogs", "auditlogs", auditFilter);
  await del("listings", "listings", { dealerId });
  await del("users", "users", { dealerId });
  await del("dealer", "dealers", { _id: dealerId });

  // ── recount affected cities (same logic as db:recount, scoped) ───────────────
  if (affectedCityIds.length) {
    const cids = affectedCityIds.map(oid);
    const cities = await C("cities").find({ _id: { $in: cids } }, { projection: { _id: 1 } }).toArray();
    const [lc, loc, dc] = await Promise.all([
      C("listings").aggregate([
        { $match: { cityId: { $in: cids }, status: "approved" } },
        { $group: { _id: "$cityId", n: { $sum: 1 } } },
      ]).toArray(),
      C("localities").aggregate([
        { $match: { cityId: { $in: cids }, isActive: true } },
        { $group: { _id: "$cityId", n: { $sum: 1 } } },
      ]).toArray(),
      C("dealers").aggregate([
        { $match: { coverageCities: { $in: cids }, status: { $ne: "banned" } } },
        { $unwind: "$coverageCities" },
        { $match: { coverageCities: { $in: cids } } },
        { $group: { _id: "$coverageCities", n: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const m = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
    const [mLc, mLoc, mDc] = [m(lc), m(loc), m(dc)];
    const ops = cities.map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        update: {
          $set: {
            listingCount: mLc.get(String(c._id)) ?? 0,
            localityCount: mLoc.get(String(c._id)) ?? 0,
            dealerCount: mDc.get(String(c._id)) ?? 0,
          },
        },
      },
    }));
    if (ops.length) await C("cities").bulkWrite(ops);
    console.log(`\n✓ Recounted ${ops.length} city counter(s).`);
  }

  await mongoose.disconnect();
  console.log(`\n✓ Dealer ${dIdStr} deleted. Backup: ${backupPath}\n`);
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ delete-dealer failed:", e?.message ?? e);
  console.error("  If a backup was already written, the data can be restored from it.");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
