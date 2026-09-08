/**
 * seed:fetch-images — populate seed-listings.json with real photos.
 *
 * For every seed listing: search Pexels by property type (+ metro / tier-2
 * variation), pick 2 UNIQUE landscape photos (never reused across all listings),
 * upload them to Cloudinary (folder "seed-listings"), and write the resulting
 * URLs back into seed-listings.json. A companion seed-image-credits.json records
 * each photo's Pexels photographer + URL (attribution is optional on Pexels but
 * nice to keep).
 *
 *   npm run seed:fetch-images              # DRY RUN — prints the plan only
 *   npm run seed:fetch-images -- --confirm # actually download + upload + write
 *
 * ENV: PEXELS_API_KEY (+ the existing CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).
 *
 * Resume: a listing whose images are already real URLs is skipped, and photos
 * used in a previous run (from the credits file) are never picked again — so a
 * re-run only does what's left. Rate-limit friendly: a delay between Pexels
 * requests (free tier is 200/hour) and between Cloudinary uploads.
 */
import "@/scripts/load-env";
import { v2 as cloudinary } from "cloudinary";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SEED_PATH = resolve(process.cwd(), "src/data/seed-listings.json");
const CREDITS_PATH = resolve(process.cwd(), "src/data/seed-image-credits.json");
const PLACEHOLDER = "REPLACE_WITH_CLOUDINARY_URL";
const CLOUD_FOLDER = "seed-listings";
const CONFIRM = process.argv.includes("--confirm");

// Rate limiting (Pexels free tier: 200 req/hour).
const PEXELS_DELAY_MS = 1500;
const CLOUD_DELAY_MS = 500;
const MAX_PEXELS_PAGES = 5; // up to 5 * 80 = 400 candidates per query
const PER_PAGE = 80;

// Metro city slugs → richer query variation.
const METRO = new Set([
  "new-delhi", "mumbai", "bengaluru-urban", "hyderabad", "chennai", "kolkata", "pune", "ahmadabad",
]);

const SHORT_TYPE: Record<string, string> = {
  flat: "flat",
  "independent-house": "house",
  villa: "villa",
  plot: "plot",
  "commercial-shop": "shop",
  office: "office",
  warehouse: "warehouse",
  pg: "pg",
};

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: { original: string; large2x: string; large: string };
  alt: string;
}
interface SeedListing {
  city: string;
  propertyType: string;
  title: string;
  images: string[];
}
interface CreditEntry {
  publicId: string;
  listingTitle: string;
  city: string;
  pexelsId: number;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pexels search query for a listing, varied by type + metro/tier-2. `variant`
 *  is a running per-type index used to alternate queries where a city has only
 *  one listing of that type (e.g. plots), so they're not all the same shot. */
function queryFor(propertyType: string, citySlug: string, variant: number): string {
  const metro = METRO.has(citySlug);
  switch (propertyType) {
    case "flat":
      return metro
        ? "modern high rise apartment interior living room"
        : "small apartment building interior living room";
    case "independent-house":
      return "independent house exterior india";
    case "villa":
      return "modern villa exterior";
    case "plot":
      // Alternate across all plots (global index) for variety + to split demand
      // over two pools, since Pexels has sparse empty-land photos.
      return variant % 2 === 0 ? "empty land plot" : "vacant land boundary";
    case "commercial-shop":
    case "office":
    case "warehouse":
      return "commercial shop building";
    default:
      return "modern apartment building";
  }
}

// ---- Pexels pooled fetch (unique-photo picker) ----
const pools = new Map<string, { photos: PexelsPhoto[]; nextPage: number; done: boolean }>();
const usedIds = new Set<number>();

async function fetchPexelsPage(query: string, page: number): Promise<PexelsPhoto[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set.");
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 429) {
    throw new Error("Pexels rate limit hit (429). Wait an hour and re-run — resume skips finished listings.");
  }
  if (!res.ok) throw new Error(`Pexels request failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { photos?: PexelsPhoto[] };
  // min 1200px width.
  return (json.photos ?? []).filter((p) => (p.width ?? 0) >= 1200);
}

/** Next unused photo for a query, fetching more pages as needed; null if none. */
async function getUniquePhoto(query: string): Promise<PexelsPhoto | null> {
  let pool = pools.get(query);
  if (!pool) {
    pool = { photos: [], nextPage: 1, done: false };
    pools.set(query, pool);
  }
  for (;;) {
    const found = pool.photos.find((p) => !usedIds.has(p.id));
    if (found) {
      usedIds.add(found.id);
      return found;
    }
    if (pool.done || pool.nextPage > MAX_PEXELS_PAGES) return null;
    await sleep(PEXELS_DELAY_MS);
    const page = await fetchPexelsPage(query, pool.nextPage);
    pool.nextPage += 1;
    if (page.length === 0) pool.done = true;
    else pool.photos.push(...page);
  }
}

function ensureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Upload a remote image to Cloudinary at a deterministic public_id. Cloudinary
 *  fetches the URL server-side. overwrite:false makes a re-run idempotent. */
async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  const res = await cloudinary.uploader.upload(imageUrl, {
    folder: CLOUD_FOLDER,
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
  });
  return res.secure_url;
}

function loadCredits(): CreditEntry[] {
  if (!existsSync(CREDITS_PATH)) return [];
  try {
    return JSON.parse(readFileSync(CREDITS_PATH, "utf8")) as CreditEntry[];
  } catch {
    return [];
  }
}

async function main() {
  const raw = JSON.parse(readFileSync(SEED_PATH, "utf8")) as {
    _readme?: unknown;
    listings: SeedListing[];
  };
  const listings = raw.listings;

  // seq = per-(city,type) index → stable public_ids. variant = per-type global
  // index → query variation (used for plots).
  const seqCounter = new Map<string, number>();
  const typeCounter = new Map<string, number>();
  const plans = listings.map((l) => {
    const key = `${l.city}::${l.propertyType}`;
    const seq = seqCounter.get(key) ?? 0;
    seqCounter.set(key, seq + 1);
    const variant = typeCounter.get(l.propertyType) ?? 0;
    typeCounter.set(l.propertyType, variant + 1);
    const already = !l.images.some((img) => String(img).includes(PLACEHOLDER));
    return { l, seq, query: queryFor(l.propertyType, l.city, variant), already };
  });

  const todo = plans.filter((p) => !p.already);
  const done = plans.length - todo.length;

  console.log(`\n${CONFIRM ? "RUN" : "DRY RUN"} — seed image fetch`);
  console.log(`  listings: ${plans.length}  |  already done: ${done}  |  to process: ${todo.length}`);
  console.log(`  photos needed: ${todo.length * 2}  (2 unique per listing)\n`);

  // Group the plan by query for a readable summary.
  const byQuery = new Map<string, number>();
  for (const p of todo) byQuery.set(p.query, (byQuery.get(p.query) ?? 0) + 1);
  console.log("  Queries that will run:");
  for (const [q, n] of [...byQuery.entries()].sort()) {
    console.log(`    • "${q}"  → ${n} listing(s), ${n * 2} photos`);
  }

  if (!CONFIRM) {
    console.log("\nDRY RUN — nothing downloaded/uploaded. Re-run with:  npm run seed:fetch-images -- --confirm\n");
    return;
  }

  // ---- real run ----
  if (!process.env.PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not set.");
  ensureCloudinary();

  const credits = loadCredits();
  // Seed usedIds with photos already used in a prior run (cross-run uniqueness).
  for (const c of credits) usedIds.add(c.pexelsId);

  const skipped: string[] = [];
  let filled = 0;

  for (const p of todo) {
    const photo1 = await getUniquePhoto(p.query);
    const photo2 = photo1 ? await getUniquePhoto(p.query) : null;
    if (!photo1 || !photo2) {
      skipped.push(`${p.l.title}  (query "${p.query}" ran out of unique photos)`);
      continue;
    }

    const short = SHORT_TYPE[p.l.propertyType] ?? p.l.propertyType;
    const pid1 = `${p.l.city}-${short}-${p.seq * 2 + 1}`;
    const pid2 = `${p.l.city}-${short}-${p.seq * 2 + 2}`;

    try {
      const url1 = await uploadToCloudinary(photo1.src.large2x, pid1);
      await sleep(CLOUD_DELAY_MS);
      const url2 = await uploadToCloudinary(photo2.src.large2x, pid2);
      await sleep(CLOUD_DELAY_MS);

      p.l.images = [url1, url2];
      credits.push(
        { publicId: pid1, listingTitle: p.l.title, city: p.l.city, pexelsId: photo1.id, photographer: photo1.photographer, photographerUrl: photo1.photographer_url, photoUrl: photo1.url },
        { publicId: pid2, listingTitle: p.l.title, city: p.l.city, pexelsId: photo2.id, photographer: photo2.photographer, photographerUrl: photo2.photographer_url, photoUrl: photo2.url },
      );

      // Persist after EACH listing so an interrupted run resumes cleanly.
      writeFileSync(SEED_PATH, JSON.stringify(raw, null, 2) + "\n");
      writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2) + "\n");
      filled += 1;
      console.log(`  ✓ ${p.l.title}`);
    } catch (err) {
      skipped.push(`${p.l.title}  (upload failed: ${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log(`\nDone. Filled ${filled} listing(s).`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} (left with placeholders):`);
    for (const s of skipped) console.log(`  ✗ ${s}`);
    console.log("\nRe-run to retry the skipped ones (finished listings are skipped).");
  }
  console.log(`\nCredits: ${CREDITS_PATH}\n`);
}

main().catch((e) => {
  console.error("\n✖ seed:fetch-images failed:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
