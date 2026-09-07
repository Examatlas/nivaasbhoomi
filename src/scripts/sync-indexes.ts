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
 * Target a specific database by setting MONGODB_URI at invocation (a real env
 * var wins over .env.local). Nothing is ever printed except the host + db name.
 *
 *   # bash / CI
 *   MONGODB_URI="<uri>" npm run db:sync-indexes
 *
 *   # PowerShell
 *   $env:MONGODB_URI="<uri>"; npm run db:sync-indexes
 *
 *   # default (uses .env.local)
 *   npm run db:sync-indexes
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
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { AlertLog } from "@/lib/db/models/AlertLog";
import { LocalityRate } from "@/lib/db/models/LocalityRate";
import { CityRate } from "@/lib/db/models/CityRate";
import { ContactMessage } from "@/lib/db/models/ContactMessage";

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
  ["SavedSearch", SavedSearch],
  ["AlertLog", AlertLog],
  ["LocalityRate", LocalityRate],
  ["CityRate", CityRate],
  ["ContactMessage", ContactMessage],
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set (checked the environment, .env.local and .env).\n");
    process.exit(1);
  }

  console.log(`\nSyncing indexes on: ${mask(uri)}`);
  await connectDB();
  console.log(`  database: ${mongoose.connection.name}\n`);

  let failed = false;
  for (const [name, model] of MODELS) {
    try {
      // syncIndexes returns the names of indexes it DROPPED (no longer in schema).
      const dropped: string[] = await model.syncIndexes();
      const current = await model.collection.indexes();
      const names = current.map((i) => i.name).join(", ");
      console.log(`✓ ${name}: in sync (${current.length} indexes: ${names})`);
      if (dropped.length) console.log(`    dropped: ${dropped.join(", ")}`);
    } catch (err) {
      failed = true;
      const e = err as { name?: string; message?: string; code?: number };
      console.error(`✖ ${name}: ${e.name ?? "Error"}: ${e.message ?? err}`);
      if (e.code) console.error(`    code: ${e.code}`);
    }
  }

  await mongoose.disconnect();
  if (failed) {
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
