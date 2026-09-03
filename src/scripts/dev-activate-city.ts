/**
 * DEV-ONLY: force a city's isActive = true, bypassing the Section 13 activation
 * guard (25 listings / 5 dealers / 3 localities). This is a local testing
 * convenience so the city page can be viewed before a city truly qualifies.
 *
 * It REFUSES to run when NODE_ENV=production. The real activation path
 * (POST /api/admin/locations/cities/[id]/activate -> canActivateCity) keeps the
 * guard fully enforced; this script does NOT touch that.
 *
 *   npm run dev:activate-city -- ranchi          # activate
 *   npm run dev:activate-city -- ranchi --off     # deactivate
 */
import "@/scripts/load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("\n✖ Refusing to run in production. This is a dev-only bypass.\n");
    process.exit(1);
  }

  const slug = process.argv[2];
  const off = process.argv.includes("--off");
  if (!slug || slug.startsWith("--")) {
    console.error("\nUsage: npm run dev:activate-city -- <city-slug> [--off]\n");
    process.exit(1);
  }

  await connectDB();
  const city = await City.findOne({ slug });
  if (!city) {
    console.error(`\n✖ City "${slug}" not found.\n`);
    process.exit(1);
  }

  city.isActive = !off;
  await city.save();

  console.log(
    `\n✓ [DEV] City "${city.name}" (/${city.slug}) isActive = ${city.isActive}` +
      `${off ? "" : "  (guard bypassed - dev only)"}\n`,
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ failed:", e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
