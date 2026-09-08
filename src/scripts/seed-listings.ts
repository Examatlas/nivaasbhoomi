/**
 * Import SEED (display-only) listings from a JSON file so a fresh city/site
 * isn't empty. See src/data/seed-listings.sample.json for the format.
 *
 *   npm run seed:listings                        # DRY RUN (default) — shows what it would do
 *   npm run seed:listings -- --confirm           # actually insert
 *   npm run seed:listings -- --update            # DRY RUN of image-only update
 *   npm run seed:listings -- --update --confirm  # update images on already-inserted seed rows
 *   npm run seed:listings -- --file=path.json --days=30 --confirm
 *
 * Every imported listing: isSeed=true, status=approved, dealerId=null,
 * seedExpiresAt=+N days. The script NEVER downloads/scrapes images — it stores
 * the Cloudinary URLs you provide as-is. MONGODB_URI comes from the environment
 * / .env.local (no hardcoded connection string). CLI only.
 *
 * --update mode: re-reads the JSON and updates ONLY the photos of the matching
 * already-inserted seed listings (matched on isSeed + cityId + localityId +
 * title). It never inserts. Use it after `seed:fetch-images` fills real URLs
 * into a JSON whose listings were already seeded with placeholders.
 */
import "@/scripts/load-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { slugify } from "@/lib/utils/slug";
import { nanoidLower } from "@/lib/utils/id";

const PROPERTY_TYPES = ["flat", "independent-house", "villa", "plot", "commercial-shop", "office", "pg", "warehouse"];
const BHKS = ["1rk", "1", "2", "3", "4", "5plus"];
const PLACEHOLDER = "REPLACE_WITH_CLOUDINARY_URL";

interface SeedInput {
  city: string;
  locality: string;
  title: string;
  description?: string;
  purpose: "sale" | "rent";
  propertyType: string;
  price: number;
  area?: number;
  bedrooms?: string;
  images?: string[];
}

function mask(uri: string): string {
  return uri.replace(/(:\/\/[^:/@]+:)[^@]+(@)/, "$1****$2");
}
function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const update = process.argv.includes("--update");
  const days = Number(arg("days") ?? "30") || 30;
  const file = arg("file") ?? "src/data/seed-listings.sample.json";

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n✖ MONGODB_URI is not set.\n");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as { listings?: SeedInput[] };
  const inputs = raw.listings ?? [];
  if (inputs.length === 0) {
    console.error(`\n✖ No "listings" array in ${file}.\n`);
    process.exit(1);
  }

  const mode = update ? "UPDATE IMAGES" : "IMPORT";
  console.log(`\n${confirm ? `⚠ LIVE ${mode}` : `DRY RUN (${mode})`} — seed listings from ${file}`);
  console.log(`Connecting to: ${mask(uri)}`);
  await connectDB();
  console.log(`Database:      ${mongoose.connection.name}\n`);

  const now = new Date();
  const seedExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const listingExpiresAt = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000); // seed cron archives sooner

  const docs: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const [i, l] of inputs.entries()) {
    const where = `#${i + 1} "${l.title ?? "(no title)"}"`;
    if (!l.title || !l.city || !l.locality) { errors.push(`${where}: missing city/locality/title`); continue; }
    if (l.purpose !== "sale" && l.purpose !== "rent") { errors.push(`${where}: purpose must be sale|rent`); continue; }
    if (!PROPERTY_TYPES.includes(l.propertyType)) { errors.push(`${where}: invalid propertyType "${l.propertyType}"`); continue; }
    if (!(typeof l.price === "number" && l.price > 0)) { errors.push(`${where}: price must be > 0`); continue; }
    if (l.bedrooms && !BHKS.includes(l.bedrooms)) { errors.push(`${where}: invalid bedrooms "${l.bedrooms}"`); continue; }

    const images = l.images ?? [];
    // In update mode, refuse to overwrite good photos with unfilled placeholders.
    if (update && images.some((u) => String(u).includes(PLACEHOLDER))) {
      errors.push(`${where}: images still placeholder — skipped (nothing to update)`);
      continue;
    }

    const city = await City.findOne(
      { $or: [{ slug: l.city.toLowerCase() }, { name: l.city }] },
      { _id: 1, stateId: 1, name: 1 },
    ).lean();
    if (!city) { errors.push(`${where}: city "${l.city}" not found`); continue; }
    const locality = await Locality.findOne(
      { cityId: city._id, $or: [{ slug: l.locality.toLowerCase() }, { name: l.locality }] },
      { _id: 1, stateId: 1 },
    ).lean();
    if (!locality) { errors.push(`${where}: locality "${l.locality}" not found in ${city.name}`); continue; }

    const slug = `${slugify(l.title).slice(0, 60)}-${nanoidLower(6)}`;
    const priceField = l.purpose === "rent" ? "monthlyRent" : "expectedPrice";
    docs.push({
      _id: new mongoose.Types.ObjectId(),
      title: l.title,
      slug,
      description: l.description ?? "",
      purpose: l.purpose,
      propertyType: l.propertyType,
      cityId: city._id,
      localityId: locality._id,
      stateId: locality.stateId ?? city.stateId ?? null,
      [priceField]: Math.round(l.price),
      ...(l.area && l.area > 0 ? { carpetArea: l.area, ...(l.purpose === "sale" ? { pricePerSqft: Math.round(l.price / l.area) } : {}) } : {}),
      ...(l.bedrooms ? { bhk: l.bedrooms } : {}),
      photos: images.map((url) => ({ url })),
      coverPhotoIndex: 0,
      status: "approved",
      isSeed: true,
      seedExpiresAt,
      dealerId: null,
      lastRefreshedAt: now,
      expiresAt: listingExpiresAt,
      viewCount: 0,
      leadCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Summary per city.
  const perCity = new Map<string, number>();
  for (const d of docs) {
    const c = String(d.cityId);
    perCity.set(c, (perCity.get(c) ?? 0) + 1);
  }
  console.log(`Parsed ${inputs.length} rows → ${docs.length} valid, ${errors.length} skipped.`);
  if (!update) console.log(`Seed expiry: ${seedExpiresAt.toISOString().slice(0, 10)} (+${days} days).`);
  if (errors.length) {
    console.log("\nSkipped:");
    for (const e of errors) console.log(`  ✗ ${e}`);
  }

  const { Listing } = await import("@/lib/db/models/Listing");

  // ---- UPDATE mode: refresh photos on already-inserted seed rows, never insert ----
  if (update) {
    type MatchFilter = {
      isSeed: true;
      cityId: mongoose.Types.ObjectId;
      localityId: mongoose.Types.ObjectId;
      title: string;
    };
    const missing: string[] = [];
    const targets: { title: string; filter: MatchFilter; photos: unknown }[] = [];
    for (const d of docs) {
      const filter: MatchFilter = {
        isSeed: true,
        cityId: d.cityId as mongoose.Types.ObjectId,
        localityId: d.localityId as mongoose.Types.ObjectId,
        title: d.title as string,
      };
      const n = await Listing.countDocuments(filter);
      if (n === 0) missing.push(String(d.title));
      else targets.push({ title: String(d.title), filter, photos: d.photos });
    }

    console.log(`\nUpdate plan: ${targets.length} matched in DB, ${missing.length} not found.`);
    if (missing.length) {
      console.log("\nNot found in DB (skipped — seed them with --confirm first):");
      for (const t of missing) console.log(`  ✗ ${t}`);
    }

    if (!confirm) {
      console.log(`\nDRY RUN — nothing updated. Re-run with:  npm run seed:listings -- --update --confirm\n`);
      await mongoose.disconnect();
      process.exit(0);
    }

    let modified = 0;
    for (const t of targets) {
      const res = await Listing.updateMany(t.filter, {
        $set: { photos: t.photos, coverPhotoIndex: 0, updatedAt: new Date() },
      });
      modified += res.modifiedCount;
      console.log(`  ✓ ${t.title}${res.matchedCount > 1 ? `  (matched ${res.matchedCount})` : ""}`);
    }
    console.log(`\n✓ Updated images on ${modified} seed listing(s).\n`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ---- INSERT mode (default) ----
  if (!confirm) {
    console.log(`\nDRY RUN — nothing inserted. Re-run with:  npm run seed:listings -- --confirm\n`);
    await mongoose.disconnect();
    process.exit(0);
  }
  if (docs.length === 0) {
    console.log("\nNothing valid to insert.\n");
    await mongoose.disconnect();
    process.exit(0);
  }

  // Direct driver insert (bypasses the submit-time validators that require
  // lat/lng etc.) — these are display-only placeholders, not dealer-filed listings.
  const res = await Listing.collection.insertMany(docs);
  console.log(`\n✓ Inserted ${res.insertedCount} seed listing(s).`);

  // The driver insert doesn't touch city.listingCount, so recompute the cached
  // counters for the affected cities (fixes the admin "0 listings" display).
  const { recountCities } = await import("@/lib/locations/recount");
  const affectedCityIds = [...new Set(docs.map((d) => String(d.cityId)))];
  const n = await recountCities(affectedCityIds);
  console.log(`✓ Recounted ${n} city counter(s).\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✖ Seed import failed:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
