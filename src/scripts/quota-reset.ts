/**
 * Manual quota reset (DEV-SPEC.txt Section 12). Same logic the daily cron runs;
 * handy for local testing.
 *
 *   npm run cron:quota-reset
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { resetMonthlyQuotas } from "@/lib/leads/quota";

async function main() {
  const res = await resetMonthlyQuotas();
  console.log(`✓ Quota reset complete: ${res.reset} dealer(s) updated.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("✖ quota-reset failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
