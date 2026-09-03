/**
 * One-off cleanup for duplicate Locality documents (data bug: the seed was run
 * twice and, because its idempotency keyed on (cityId, slug), the second run's
 * collision-suffix minted new slugs like "adalahatu-2" instead of matching the
 * existing "adalahatu" - producing two docs per (cityId, name)).
 *
 * For each (cityId, name) group with more than one document it keeps ONE
 * canonical doc - preferring the one whose slug === slugify(name) (the stable
 * SEO slug), else the oldest - unions every duplicate's pincodes into it, and
 * deletes the rest. Safe to re-run (a no-op once clean).
 *
 *   npm run dedupe:localities            # dry run - reports what it would do
 *   npm run dedupe:localities -- --apply # actually delete
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { slugify } from "@/lib/utils/slug";

interface GroupDoc {
  _id: { cityId: mongoose.Types.ObjectId; name: string };
  docs: { id: mongoose.Types.ObjectId; slug: string; pincodes?: string[] }[];
}

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();
  const coll = mongoose.connection.db!.collection("localities");

  console.log(
    `\n${apply ? "APPLYING" : "DRY RUN"} - localities before: ${await coll.countDocuments()}`,
  );

  const cursor = coll.aggregate<GroupDoc>(
    [
      {
        $group: {
          _id: { cityId: "$cityId", name: "$name" },
          docs: { $push: { id: "$_id", slug: "$slug", pincodes: "$pincodes" } },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ],
    { allowDiskUse: true },
  );

  const deleteBatch: mongoose.Types.ObjectId[] = [];
  const pincodeOps: { keeper: mongoose.Types.ObjectId; add: string[] }[] = [];
  let groups = 0;
  let toDelete = 0;

  const flush = async () => {
    if (!apply) {
      deleteBatch.length = 0;
      pincodeOps.length = 0;
      return;
    }
    if (pincodeOps.length) {
      await coll.bulkWrite(
        pincodeOps.map((op) => ({
          updateOne: {
            filter: { _id: op.keeper },
            update: { $addToSet: { pincodes: { $each: op.add } } },
          },
        })),
        { ordered: false },
      );
      pincodeOps.length = 0;
    }
    if (deleteBatch.length) {
      await coll.deleteMany({ _id: { $in: deleteBatch } });
      deleteBatch.length = 0;
    }
  };

  for await (const g of cursor) {
    groups++;
    const base = slugify(g._id.name);
    // Keeper: the base-slug doc, else the lowest _id (oldest).
    const sorted = [...g.docs].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const keeper = sorted.find((d) => d.slug === base) ?? sorted[0]!;

    const unionPincodes = new Set<string>();
    for (const d of g.docs) {
      if (d.id.equals(keeper.id)) continue;
      (d.pincodes ?? []).forEach((p) => unionPincodes.add(p));
      deleteBatch.push(d.id);
      toDelete++;
    }
    // Only add pincodes the keeper might be missing.
    const keeperPins = new Set(keeper.pincodes ?? []);
    const missing = [...unionPincodes].filter((p) => !keeperPins.has(p));
    if (missing.length) pincodeOps.push({ keeper: keeper.id, add: missing });

    if (deleteBatch.length >= 5000 || pincodeOps.length >= 5000) await flush();
    if (groups % 20000 === 0)
      process.stdout.write(`\r  groups scanned: ${groups}  to-delete: ${toDelete}   `);
  }
  await flush();

  console.log(`\n\n  duplicate groups:   ${groups.toLocaleString()}`);
  console.log(
    `  documents ${apply ? "deleted" : "to delete"}: ${toDelete.toLocaleString()}`,
  );
  console.log(`  localities after:   ${(await coll.countDocuments()).toLocaleString()}`);
  if (!apply) console.log("\n  (dry run - re-run with --apply to delete)\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ dedupe failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
