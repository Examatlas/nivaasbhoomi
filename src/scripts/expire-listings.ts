/**
 * Run the listing-expiry cron manually (DEV-SPEC.txt Section 13). Same logic the
 * daily cron runs.
 *
 *   npm run cron:expiry
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { runExpiry } from "@/lib/listings/expiry";

async function main() {
  const r = await runExpiry();
  console.log(
    `✓ Expiry run: expired=${r.expired}, warningsSent=${r.warningsSent}, ` +
      `localitiesDeactivated=${r.localitiesDeactivated.length}, cityAlerts=${r.cityAlerts.length}`,
  );
  if (r.cityAlerts.length) {
    for (const a of r.cityAlerts) {
      console.log(`  ⚠ city ${a.cityId} now has ${a.listingCount} approved listings (< 25)`);
    }
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("✖ expire-listings failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
