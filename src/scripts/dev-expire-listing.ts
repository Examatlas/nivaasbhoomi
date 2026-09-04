/**
 * DEV-ONLY: push a listing's expiresAt into the past so the next expiry run (or
 * `npm run cron:expiry`) marks it expired. Refuses in production.
 *
 *   npm run dev:expire-listing -- <listingId>
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { devExpireListing } from "@/lib/listings/expiry";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("✖ Refusing to run in production.");
    process.exit(1);
  }
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npm run dev:expire-listing -- <listingId>");
    process.exit(1);
  }
  const ok = await devExpireListing(id);
  console.log(
    ok
      ? `✓ [DEV] Listing ${id} expiresAt set to the past. Run: npm run cron:expiry`
      : `✖ Listing ${id} not found.`,
  );
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✖ failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
