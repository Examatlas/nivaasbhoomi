/**
 * One-time quota migration (STEP 3.1).
 *
 * Brings every existing dealer onto the new monthly quota:
 *   - maxLeadsPerMonth  → DEFAULT_MONTHLY_QUOTA (30, or DEALER_MONTHLY_QUOTA)
 *   - leadsUsedThisMonth < 0  → 0  (never let a quota go negative)
 *   - lastResetAt unset → now (so the next 1st-of-month reset behaves)
 *
 * DRY RUN by default — prints what WOULD change and touches nothing. Pass
 * --confirm to actually write. Target a DB with MONGODB_URI as usual.
 *
 *   npm run db:set-quota            # dry run
 *   npm run db:set-quota -- --confirm
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { DEFAULT_MONTHLY_QUOTA } from "@/lib/leads/quota-config";

function mask(uri: string): string {
  return uri.replace(/(:\/\/[^:/@]+:)[^@]+(@)/, "$1****$2");
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set.\n");
    process.exit(1);
  }

  console.log(`\n${confirm ? "APPLYING" : "DRY RUN"} — set-quota on: ${mask(uri)}`);
  await connectDB();
  console.log(`  database:   ${mongoose.connection.name}`);
  console.log(`  target quota: ${DEFAULT_MONTHLY_QUOTA}\n`);

  const dealers = await Dealer.find(
    {},
    { businessName: 1, maxLeadsPerMonth: 1, leadsUsedThisMonth: 1, lastResetAt: 1 },
  ).lean();

  let quotaChanges = 0;
  let negativeFixes = 0;
  let lastResetInits = 0;
  for (const d of dealers) {
    const changes: string[] = [];
    if ((d.maxLeadsPerMonth ?? 0) !== DEFAULT_MONTHLY_QUOTA) {
      changes.push(`quota ${d.maxLeadsPerMonth ?? "—"} → ${DEFAULT_MONTHLY_QUOTA}`);
      quotaChanges += 1;
    }
    if ((d.leadsUsedThisMonth ?? 0) < 0) {
      changes.push(`used ${d.leadsUsedThisMonth} → 0`);
      negativeFixes += 1;
    }
    if (!d.lastResetAt) {
      changes.push(`lastResetAt → now`);
      lastResetInits += 1;
    }
    if (changes.length) {
      console.log(`  • ${d.businessName ?? String(d._id)}: ${changes.join(", ")}`);
    }
  }

  console.log(
    `\nSummary: ${dealers.length} dealers · ${quotaChanges} quota · ${negativeFixes} negative-used · ${lastResetInits} lastReset-init`,
  );

  if (confirm) {
    const now = new Date();
    const r1 = await Dealer.updateMany({}, { $set: { maxLeadsPerMonth: DEFAULT_MONTHLY_QUOTA } });
    const r2 = await Dealer.updateMany(
      { leadsUsedThisMonth: { $lt: 0 } },
      { $set: { leadsUsedThisMonth: 0 } },
    );
    const r3 = await Dealer.updateMany(
      { $or: [{ lastResetAt: null }, { lastResetAt: { $exists: false } }] },
      { $set: { lastResetAt: now } },
    );
    console.log(
      `\n✓ Applied. quota:${r1.modifiedCount} negatives:${r2.modifiedCount} lastReset:${r3.modifiedCount}\n`,
    );
  } else {
    console.log("\nDRY RUN — nothing written. Re-run with:  npm run db:set-quota -- --confirm\n");
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("✖ set-quota failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
