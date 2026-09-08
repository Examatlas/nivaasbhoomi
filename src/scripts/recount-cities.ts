/**
 * Recompute the cached city.* counters (listingCount / localityCount /
 * dealerCount) from live data. The seed importer inserts listings straight
 * through the driver, so it leaves these counters stale — run this after a seed
 * import (or any bulk listing write) to fix the admin display.
 *
 *   npm run db:recount            # recount every city
 */
import "@/scripts/load-env";
import mongoose from "mongoose";

import { recountCities } from "@/lib/locations/recount";

async function main() {
  const n = await recountCities();
  console.log(`\n✓ Recounted ${n} cities.\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ recount failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
