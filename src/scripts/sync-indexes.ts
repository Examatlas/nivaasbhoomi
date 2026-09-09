/**
 * Sync every model's indexes to match the schema.
 *
 * The app connects with `autoIndex: false` (indexes are never built on the
 * request path), so a newly declared schema index does NOT exist in a database
 * until this script is run against it. `Model.syncIndexes()` creates missing
 * indexes AND drops indexes that are no longer in the schema — so it is the one
 * repeatable command that makes a database's indexes exactly match the code.
 *
 * Safe to re-run: a no-op when everything is already in sync.
 *
 *   # DRY RUN — report what WOULD be created/dropped, change nothing:
 *   npm run db:sync-indexes -- --dry-run
 *
 *   # apply (default)
 *   npm run db:sync-indexes
 *
 * Target a specific database by setting MONGODB_URI at invocation (a real env
 * var wins over .env.local):
 *   MONGODB_URI="<uri>" npm run db:sync-indexes -- --dry-run     # bash / CI
 *   $env:MONGODB_URI="<uri>"; npm run db:sync-indexes            # PowerShell
 *
 * SAFETY: because a real run DROPS indexes no longer in the schema, always
 * `--dry-run` first against an unfamiliar database. Before applying, this script
 * pre-checks every UNIQUE index it would create for existing duplicate data; if
 * any collection would fail the unique build, it reports a clean error and
 * exits WITHOUT changing anything (never a half-applied state).
 */
import "@/scripts/load-env";
import mongoose, { type Model } from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { State } from "@/lib/db/models/State";
import { Lead } from "@/lib/db/models/Lead";
import { User } from "@/lib/db/models/User";
import { Otp } from "@/lib/db/models/Otp";
import { OtpRequestLog } from "@/lib/db/models/OtpRequestLog";
import { DealerSignupLog } from "@/lib/db/models/DealerSignupLog";
import { ToolSubmitLog } from "@/lib/db/models/ToolSubmitLog";
import { AgentApiLog } from "@/lib/db/models/AgentApiLog";
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { SavedListing } from "@/lib/db/models/SavedListing";
import { ListingReport } from "@/lib/db/models/ListingReport";
import { AlertLog } from "@/lib/db/models/AlertLog";
import { LocalityRate } from "@/lib/db/models/LocalityRate";
import { CityRate } from "@/lib/db/models/CityRate";
import { ContactMessage } from "@/lib/db/models/ContactMessage";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { Blog } from "@/lib/db/models/Blog";
import { Conversation } from "@/lib/db/models/Conversation";
import { DeadLetter } from "@/lib/db/models/DeadLetter";
import { EmailChangeToken } from "@/lib/db/models/EmailChangeToken";
import { N8nRetry } from "@/lib/db/models/N8nRetry";
import { PasswordResetToken } from "@/lib/db/models/PasswordResetToken";
import { Setting } from "@/lib/db/models/Setting";
import { WhatsAppSendLog } from "@/lib/db/models/WhatsAppSendLog";

function mask(uri: string): string {
  return uri.replace(/(:\/\/[^:/@]+:)[^@]+(@)/, "$1****$2");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: [string, Model<any>][] = [
  ["Dealer", Dealer],
  ["Listing", Listing],
  ["City", City],
  ["Locality", Locality],
  ["State", State],
  ["Lead", Lead],
  ["User", User],
  ["Otp", Otp],
  ["OtpRequestLog", OtpRequestLog],
  ["DealerSignupLog", DealerSignupLog],
  ["ToolSubmitLog", ToolSubmitLog],
  ["AgentApiLog", AgentApiLog],
  ["SavedSearch", SavedSearch],
  ["SavedListing", SavedListing],
  ["ListingReport", ListingReport],
  ["AlertLog", AlertLog],
  ["LocalityRate", LocalityRate],
  ["CityRate", CityRate],
  ["ContactMessage", ContactMessage],
  ["AuditLog", AuditLog],
  ["Blog", Blog],
  ["Conversation", Conversation],
  ["DeadLetter", DeadLetter],
  ["EmailChangeToken", EmailChangeToken],
  ["N8nRetry", N8nRetry],
  ["PasswordResetToken", PasswordResetToken],
  ["Setting", Setting],
  ["WhatsAppSendLog", WhatsAppSendLog],
];

type IndexOptions = {
  unique?: boolean;
  expireAfterSeconds?: number;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  [k: string]: unknown;
};
type IndexKey = Record<string, 1 | -1 | string>;
type Create = { key: IndexKey; opts: IndexOptions };
type Conflict = { key: IndexKey; samples: { value: unknown; count: number }[] };
type Plan = { name: string; creates: Create[]; drops: string[]; conflicts: Conflict[] };

/** One-line annotation of an index's notable options. */
function annot(o: IndexOptions): string {
  const a: string[] = [];
  if (o.unique) a.push("UNIQUE");
  if (o.expireAfterSeconds !== undefined) a.push(`TTL ${o.expireAfterSeconds}s`);
  if (o.partialFilterExpression) a.push("partial");
  if (o.sparse) a.push("sparse");
  return a.length ? `  [${a.join(", ")}]` : "";
}

/**
 * Find existing documents that would violate a UNIQUE index. Honours partial
 * (only matching docs) and sparse (skip null/missing key fields) semantics; for
 * a plain unique index, missing/null values collide the same way Mongo's index
 * build would. Returns a small sample of colliding groups (empty = safe).
 */
async function findUniqueConflicts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  key: IndexKey,
  opts: IndexOptions,
): Promise<{ value: unknown; count: number }[]> {
  const fields = Object.keys(key);
  const pipeline: Record<string, unknown>[] = [];
  if (opts.partialFilterExpression) pipeline.push({ $match: opts.partialFilterExpression });
  if (opts.sparse) {
    const m: Record<string, unknown> = {};
    for (const f of fields) m[f] = { $exists: true, $ne: null };
    pipeline.push({ $match: m });
  }
  const groupId: Record<string, string> = {};
  for (const f of fields) groupId[f] = `$${f}`;
  pipeline.push(
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  );
  const rows = await model.collection
    .aggregate(pipeline, { allowDiskUse: true })
    .toArray()
    .catch(() => [] as { _id: unknown; count: number }[]);
  return rows.map((r) => ({ value: r._id, count: r.count }));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set (checked the environment, .env.local and .env).\n");
    process.exit(1);
  }

  // Never let mongoose auto-create collections on connect. Otherwise a dry run
  // (or a refused apply) would silently create ~28 empty collections before we
  // even read the DB. Index creation is done explicitly by syncIndexes() in the
  // apply phase, which creates any missing collection itself.
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);

  console.log(`\n${dryRun ? "DRY RUN — planning indexes on" : "Syncing indexes on"}: ${mask(uri)}`);
  await connectDB();
  console.log(`  database: ${mongoose.connection.name}\n`);

  // Collections that already exist. For a collection that does NOT exist,
  // planning must not touch it: calling diffIndexes()/aggregate() would
  // auto-create an empty collection, which breaks the "dry run changes nothing"
  // contract. We synthesise its plan from the schema instead (a real apply will
  // create the collection + all its indexes; an empty collection has no data,
  // so no unique conflict is possible).
  const existing = new Set(
    (await mongoose.connection.db!.listCollections().toArray()).map((c) => c.name),
  );

  // ── Phase 1: plan every model (read-only: diffIndexes + unique pre-check) ──
  const plans: Plan[] = [];
  let planFailed = false;

  for (const [name, model] of MODELS) {
    try {
      // Map each schema index's key → its options (unique/ttl/partial/sparse),
      // so we can annotate what diffIndexes reports and know which are unique.
      const optsByKey = new Map<string, IndexOptions>();
      for (const [k, o] of model.schema.indexes() as [IndexKey, IndexOptions][]) {
        optsByKey.set(JSON.stringify(k), o ?? {});
      }

      let creates: Create[];
      let drops: string[];
      const conflicts: Conflict[] = [];

      if (!existing.has(model.collection.collectionName)) {
        // Collection absent → everything in the schema will be created, nothing
        // dropped, and there is no data to conflict with.
        creates = (model.schema.indexes() as [IndexKey, IndexOptions][]).map(([key, opts]) => ({
          key,
          opts: opts ?? {},
        }));
        drops = [];
      } else {
        // diffIndexes is read-only: what syncIndexes WOULD create/drop.
        const diff = (await model.diffIndexes()) as { toCreate?: unknown[]; toDrop?: string[] };
        creates = (diff.toCreate ?? []).map((item) => {
          const key = (Array.isArray(item) ? item[0] : item) as IndexKey;
          const tupleOpts = (Array.isArray(item) ? item[1] : undefined) as IndexOptions | undefined;
          const opts = optsByKey.get(JSON.stringify(key)) ?? tupleOpts ?? {};
          return { key, opts };
        });
        drops = diff.toDrop ?? [];

        // Pre-check every UNIQUE index we would create for existing duplicates.
        for (const c of creates) {
          if (!c.opts.unique) continue;
          const samples = await findUniqueConflicts(model, c.key, c.opts);
          if (samples.length) conflicts.push({ key: c.key, samples });
        }
      }

      plans.push({ name, creates, drops, conflicts });
    } catch (err) {
      planFailed = true;
      const e = err as { name?: string; message?: string };
      console.error(`✖ ${name}: planning failed: ${e.name ?? "Error"}: ${e.message ?? err}`);
    }
  }

  // ── Phase 2: print the plan ────────────────────────────────────────────────
  let willCreate = 0;
  let willDrop = 0;
  const conflictModels: Plan[] = [];

  for (const p of plans) {
    const inSync = p.creates.length === 0 && p.drops.length === 0;
    if (inSync) {
      console.log(`• ${p.name}: in sync`);
      continue;
    }
    console.log(`• ${p.name}:`);
    for (const c of p.creates) {
      willCreate++;
      console.log(`    + create ${JSON.stringify(c.key)}${annot(c.opts)}`);
    }
    for (const d of p.drops) {
      willDrop++;
      console.log(`    - DROP   ${d}   ⚠`);
    }
    if (p.conflicts.length) {
      conflictModels.push(p);
      for (const cf of p.conflicts) {
        console.log(`    ✖ UNIQUE CONFLICT on ${JSON.stringify(cf.key)} — existing duplicates:`);
        for (const s of cf.samples) {
          console.log(`        ${JSON.stringify(s.value)} ×${s.count}`);
        }
      }
    }
  }

  console.log(`\nSummary: ${willCreate} to create, ${willDrop} to drop${willDrop ? " (⚠ drops)" : ""}.`);

  // ── Dry run stops here — nothing was changed ───────────────────────────────
  if (dryRun) {
    if (conflictModels.length) {
      console.log(
        `\n⚠ ${conflictModels.length} model(s) have UNIQUE-index conflicts above. A real run would ` +
          `refuse to apply until the duplicates are resolved.`,
      );
    }
    await mongoose.disconnect();
    console.log("\nDRY RUN — no changes were made.\n");
    process.exit(planFailed ? 1 : 0);
  }

  // ── Before applying anything: refuse if any unique index would fail ────────
  // (Checked across ALL models first, so we never half-apply then hit a
  //  conflict on a later model.)
  if (conflictModels.length) {
    console.error("\n✖ Refusing to apply — UNIQUE index build would FAIL on existing data:");
    for (const p of conflictModels) {
      for (const cf of p.conflicts) {
        console.error(`    ${p.name} ${JSON.stringify(cf.key)}: ${cf.samples.length}+ duplicate value(s)`);
      }
    }
    console.error(
      "\n  Nothing was changed. Resolve the duplicate data (or adjust the index) and re-run.\n",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (planFailed) {
    console.error("\n✖ Planning failed for one or more models (see above). Nothing was changed.\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Phase 3: apply. Unique conflicts are already ruled out, so the only
  //    remaining failures are unexpected; report them per model. ─────────────
  let applyFailed = false;
  for (const [name, model] of MODELS) {
    try {
      const dropped: string[] = await model.syncIndexes();
      const current = await model.collection.indexes();
      console.log(`✓ ${name}: in sync (${current.length} indexes)`);
      if (dropped.length) console.log(`    dropped: ${dropped.join(", ")}`);
    } catch (err) {
      applyFailed = true;
      const e = err as { name?: string; message?: string; code?: number };
      console.error(`✖ ${name}: ${e.name ?? "Error"}: ${e.message ?? err}`);
      if (e.code) console.error(`    code: ${e.code}`);
    }
  }

  await mongoose.disconnect();
  if (applyFailed) {
    console.error("\n✖ One or more models failed to sync. See errors above.\n");
    process.exit(1);
  }
  console.log("\n✓ All models in sync.\n");
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n✖ Index sync FAILED.\n");
  console.error(`  ${err?.name ?? "Error"}: ${err?.message ?? err}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
