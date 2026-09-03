/**
 * Seed States, Cities and Localities from the India Post pincode directory.
 * DEV-SPEC.txt Section 18 P1: "P1 se pehle kuch aur mat banao" - this is the
 * foundation the whole multi-city architecture and SEO taxonomy sits on.
 *
 * Dataset (public, free): the "All India Pincode Directory" from India Post,
 * published on data.gov.in. Download the CSV and point this script at it:
 *
 *   https://www.data.gov.in/catalog/all-india-pincode-directory
 *
 * The parser is tolerant of the column-name variants seen across mirrors of
 * that dataset (officename/postofficename, district/districtsname,
 * statename/state, latitude/longitude), so most published copies work as-is.
 *
 * Run (see the exact command in the report / README):
 *   npx tsx src/scripts/seed-locations.ts <path-to-pincodes.csv>
 *
 * Taxonomy mapping decision (dataset -> our models):
 *   State    = StateName
 *   City     = District        (the cleanest city-grain column present in EVERY
 *                               version of the dataset; matches the spec's
 *                               collision examples, which are all districts)
 *   Locality = Post office name (cleaned of the S.O/B.O/H.O suffixes), with all
 *                               pincodes of the offices sharing that name folded
 *                               into locality.pincodes
 *
 * Idempotent: every write is an upsert keyed on a natural key, and immutable
 * fields (slugs, isActive) are written with $setOnInsert so re-running never
 * changes an assigned slug or undoes an admin activation. Bulk writes only.
 */

import "@/scripts/load-env";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import mongoose, { type AnyBulkWriteOperation } from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import { City, type CityDoc } from "@/lib/db/models/City";
import { Locality, type LocalityDoc } from "@/lib/db/models/Locality";
import { slugify, generateCitySlug, generateLocalitySlug } from "@/lib/utils/slug";
import { classifyCityTier } from "@/scripts/city-classification";
import { resolveStateCode } from "@/scripts/state-codes";

const BATCH = 2000;

// ---- Column detection -------------------------------------------------------

type RawRow = Record<string, string>;

function pick(row: RawRow, headerMap: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const key = headerMap.get(alias);
    if (key !== undefined) {
      const value = row[key];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
  }
  return "";
}

/** Map normalised header -> actual header string, so lookups are case/space-proof. */
function buildHeaderMap(fields: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fields) {
    map.set(f.toLowerCase().replace(/[^a-z0-9]/g, ""), f);
  }
  return map;
}

// ---- Value normalisation ----------------------------------------------------

/**
 * The India Post CSV uses the literal string "NA" for missing values (715 rows
 * have district "NA", and one statename is "NA"). Treat those as empty so such
 * rows are skipped rather than creating a city called "Na".
 */
function naToEmpty(value: string): string {
  const v = value.trim();
  return /^n\.?a\.?$/i.test(v) ? "" : v;
}

/**
 * Display-case a name from the dataset. State and district names arrive fully
 * UPPERCASE ("TELANGANA", "KUMURAM BHEEM ASIFABAD"), which would read as
 * shouting on the public site. Title-case only tokens that are entirely upper-
 * or entirely lower-case, leaving already-mixed-case names untouched so we never
 * mangle a correctly-cased office name. Slugs are unaffected: slugify lowercases
 * first, so "Telangana" and "TELANGANA" produce the same slug.
 */
function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => {
      const letters = word.replace(/[^a-zA-Z]/g, "");
      const isUpper = letters.length > 0 && letters === letters.toUpperCase();
      // Preserve dotted all-caps acronyms as-is: "Y.S.R." -> "Y.S.R.",
      // "S.P.S." -> "S.P.S." (several Andhra district names use these).
      if (isUpper && word.includes(".")) return word;
      const isUniformCase =
        letters.length > 0 && (isUpper || letters === letters.toLowerCase());
      if (!isUniformCase) return word; // preserve deliberate mixed case
      // Capitalise the first letter of each hyphen-separated part.
      return word
        .toLowerCase()
        .replace(
          /(^|[-/])([a-z])/g,
          (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
        );
    })
    .join(" ");
}

// ---- Post office name cleaning ----------------------------------------------

/** "Kanke Road S.O" -> "Kanke Road"; drops office-type suffix + parentheticals. */
function cleanLocalityName(officeName: string): string {
  return officeName
    .replace(/\s*\([^)]*\)\s*$/, "") // trailing "(...)"
    .replace(/\s+(B\.?O|S\.?O|H\.?O|G\.?P\.?O|P\.?O|E\.?D\.?S\.?O)\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- In-memory aggregation types --------------------------------------------

interface CityAgg {
  name: string;
  stateName: string;
  tier: 1 | 2 | 3;
  lat?: number;
  lng?: number;
}

interface LocalityAgg {
  name: string;
  stateName: string;
  cityName: string;
  pincodes: Set<string>;
  lat?: number;
  lng?: number;
}

function num(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

async function bulkInBatches<T>(
  label: string,
  ops: T[],
  run: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH) {
    const chunk = ops.slice(i, i + BATCH);
    await run(chunk);
    process.stdout.write(
      `\r  ${label}: ${Math.min(i + BATCH, ops.length)}/${ops.length}   `,
    );
  }
  process.stdout.write("\n");
}

async function main() {
  const csvArg = process.argv[2] ?? process.env.PINCODE_CSV ?? "data/pincodes.csv";
  const csvPath = resolve(process.cwd(), csvArg);

  if (!existsSync(csvPath)) {
    console.error(
      `\n✖ Pincode CSV not found at: ${csvPath}\n\n` +
        `  Download the All India Pincode Directory CSV from\n` +
        `  https://www.data.gov.in/catalog/all-india-pincode-directory\n` +
        `  and pass its path:\n\n` +
        `    npx tsx src/scripts/seed-locations.ts <path-to-pincodes.csv>\n`,
    );
    process.exit(1);
  }

  console.log(`\nReading ${csvPath} …`);
  const csv = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<RawRow>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows = parsed.data;
  const fields = parsed.meta.fields ?? [];
  const headerMap = buildHeaderMap(fields);
  console.log(
    `  Parsed ${rows.length.toLocaleString()} rows. Columns: ${fields.join(", ")}`,
  );

  // --- Aggregate in memory ---
  const states = new Map<string, string>(); // slug -> canonical name
  const cities = new Map<string, CityAgg>(); // `${stateSlug}::${citySlug}` -> agg
  const localities = new Map<string, LocalityAgg>(); // `${stateSlug}::${citySlug}::${locSlug}` -> agg

  let skipped = 0;
  for (const row of rows) {
    // "NA" is the dataset's missing-value marker - normalise it to empty so the
    // guard below drops those rows instead of coining a "Na" state or city.
    const rawState = naToEmpty(pick(row, headerMap, ["statename", "state"]));
    const rawDistrict = naToEmpty(
      pick(row, headerMap, ["district", "districtsname", "districtname"]),
    );
    const rawOffice = naToEmpty(
      pick(row, headerMap, ["officename", "postofficename", "office"]),
    );
    const pincode = pick(row, headerMap, ["pincode", "pin", "pincode"]);
    const lat = num(pick(row, headerMap, ["latitude", "lat"]));
    const lng = num(pick(row, headerMap, ["longitude", "long", "lng", "longitud"]));

    if (!rawState || !rawDistrict || !rawOffice || !/^\d{6}$/.test(pincode)) {
      skipped++;
      continue;
    }

    // Display names title-cased (dataset ships UPPERCASE); slugs derive from the
    // same values and are case-independent, so classification/collision are
    // unaffected.
    const stateName = toTitleCase(rawState);
    const districtName = toTitleCase(rawDistrict);
    const stateSlug = slugify(stateName);
    const citySlug = slugify(districtName);
    const localityName = toTitleCase(cleanLocalityName(rawOffice));
    if (!localityName) {
      skipped++;
      continue;
    }
    const locSlug = slugify(localityName);

    states.set(stateSlug, stateName);

    const cityKey = `${stateSlug}::${citySlug}`;
    if (!cities.has(cityKey)) {
      cities.set(cityKey, {
        name: districtName,
        stateName,
        tier: classifyCityTier(districtName, stateName),
        lat,
        lng,
      });
    }

    const locKey = `${cityKey}::${locSlug}`;
    const existing = localities.get(locKey);
    if (existing) {
      existing.pincodes.add(pincode);
      existing.lat ??= lat;
      existing.lng ??= lng;
    } else {
      localities.set(locKey, {
        name: localityName,
        stateName,
        cityName: districtName,
        pincodes: new Set([pincode]),
        lat,
        lng,
      });
    }
  }

  console.log(
    `  Aggregated: ${states.size} states, ${cities.size} cities, ` +
      `${localities.size} localities (${skipped.toLocaleString()} rows skipped).`,
  );

  await connectDB();
  console.log("Connected to MongoDB. Seeding …\n");

  // --- 1. States (upsert, immutable fields via $setOnInsert) ---
  const stateOps = [...states.entries()].map(([slug, name]) => ({
    updateOne: {
      filter: { name },
      update: {
        $setOnInsert: {
          name,
          slug,
          code: resolveStateCode(name),
          isActive: false,
        },
      },
      upsert: true,
    },
  }));
  await bulkInBatches("states", stateOps, (chunk) =>
    State.bulkWrite(chunk, { ordered: false }),
  );

  const stateIdByName = new Map<string, mongoose.Types.ObjectId>();
  for (const s of await State.find({}, { name: 1 }).lean()) {
    stateIdByName.set(s.name, s._id as mongoose.Types.ObjectId);
  }

  // --- 2. Cities (slug collision rule: higher tier keeps the plain slug) ---
  // Seed the used-slug set from any cities already in the DB so existing slugs
  // are respected and never regenerated (Section 6: slug NEVER changes).
  const usedCitySlugs = new Set<string>();
  const existingCityKey = new Set<string>(); // `${stateName}::${cityName}`
  for (const c of await City.find({}, { slug: 1, name: 1, stateId: 1 }).lean()) {
    usedCitySlugs.add(c.slug);
    existingCityKey.add(`${String(c.stateId)}::${c.name}`);
  }

  // Process new cities highest-priority-first: tier asc, then state, then name -
  // deterministic across runs so slug assignment is stable.
  const orderedCities = [...cities.values()].sort(
    (a, b) =>
      a.tier - b.tier ||
      a.stateName.localeCompare(b.stateName) ||
      a.name.localeCompare(b.name),
  );

  const cityOps: AnyBulkWriteOperation<CityDoc>[] = [];
  for (const c of orderedCities) {
    const stateId = stateIdByName.get(c.stateName);
    if (!stateId) continue;
    if (existingCityKey.has(`${String(stateId)}::${c.name}`)) continue; // already seeded

    const slug = generateCitySlug(c.name, c.stateName, (s) => usedCitySlugs.has(s));
    usedCitySlugs.add(slug);

    cityOps.push({
      updateOne: {
        filter: { name: c.name, stateId },
        update: {
          $setOnInsert: {
            name: c.name,
            slug,
            stateId,
            tier: c.tier,
            isActive: false,
            ...(c.lat != null ? { lat: c.lat } : {}),
            ...(c.lng != null ? { lng: c.lng } : {}),
          },
        },
        upsert: true,
      },
    });
  }
  await bulkInBatches("cities", cityOps, (chunk) =>
    City.bulkWrite(chunk, { ordered: false }),
  );

  // Build a (stateId::name) -> cityId map for locality linking.
  const cityIdByKey = new Map<string, mongoose.Types.ObjectId>();
  for (const c of await City.find({}, { name: 1, stateId: 1 }).lean()) {
    cityIdByKey.set(`${String(c.stateId)}::${c.name}`, c._id as mongoose.Types.ObjectId);
  }

  // --- 3. Localities (slug unique WITHIN city; pincodes merged) ---
  // A locality's stable identity is (cityId, name) - the slug can drift between
  // runs because its collision suffix depends on what is already in the DB. So
  // we upsert on (cityId, name) and REUSE an existing locality's slug rather
  // than generating a fresh (suffixed) one. This is what makes re-seeding truly
  // idempotent: a second run matches by name and merges pincodes instead of
  // inserting "adalahatu-2".
  const existingSlugByCityName = new Map<string, Map<string, string>>(); // cityKey -> (name -> slug)
  const usedLocSlugByCity = new Map<string, Set<string>>(); // cityKey -> slugs in use
  for (const l of await Locality.find({}, { name: 1, slug: 1, cityId: 1 }).lean()) {
    const key = String(l.cityId);
    if (!existingSlugByCityName.has(key)) existingSlugByCityName.set(key, new Map());
    existingSlugByCityName.get(key)!.set(l.name, l.slug);
    if (!usedLocSlugByCity.has(key)) usedLocSlugByCity.set(key, new Set());
    usedLocSlugByCity.get(key)!.add(l.slug);
  }

  // Deterministic order so per-city slug suffixing is stable across runs.
  const orderedLocalities = [...localities.values()].sort(
    (a, b) =>
      a.stateName.localeCompare(b.stateName) ||
      a.cityName.localeCompare(b.cityName) ||
      a.name.localeCompare(b.name),
  );

  const localityOps: AnyBulkWriteOperation<LocalityDoc>[] = [];
  for (const l of orderedLocalities) {
    const stateId = stateIdByName.get(l.stateName);
    if (!stateId) continue;
    const cityId = cityIdByKey.get(`${String(stateId)}::${l.cityName}`);
    if (!cityId) continue;

    const cityKey = String(cityId);
    if (!usedLocSlugByCity.has(cityKey)) usedLocSlugByCity.set(cityKey, new Set());
    const used = usedLocSlugByCity.get(cityKey)!;

    // Reuse the existing slug if this (city, name) is already seeded; otherwise
    // generate a fresh unique-within-city slug and reserve it.
    const existingSlug = existingSlugByCityName.get(cityKey)?.get(l.name);
    let slug: string;
    if (existingSlug) {
      slug = existingSlug;
    } else {
      slug = generateLocalitySlug(l.name, (s) => used.has(s));
      used.add(slug);
    }

    const pincodes = [...l.pincodes].sort();

    localityOps.push({
      updateOne: {
        // Identity is (cityId, name) - NOT slug, which can differ between runs.
        filter: { cityId, name: l.name },
        update: {
          // Immutable identity + activation state only set on insert.
          $setOnInsert: {
            name: l.name,
            slug,
            cityId,
            stateId,
            isActive: false,
            status: "approved", // seeded data is pre-approved (Section: seed brief)
            ...(l.lat != null ? { lat: l.lat } : {}),
            ...(l.lng != null ? { lng: l.lng } : {}),
          },
          // Pincodes merged on every run so re-seeding picks up new offices.
          $addToSet: { pincodes: { $each: pincodes } },
        },
        upsert: true,
      },
    });
  }
  await bulkInBatches("localities", localityOps, (chunk) =>
    Locality.bulkWrite(chunk, { ordered: false }),
  );

  // --- 4. Maintain city.localityCount ---
  const counts = await Locality.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $group: { _id: "$cityId", n: { $sum: 1 } } },
  ]);
  const countOps = counts.map((c) => ({
    updateOne: {
      filter: { _id: c._id },
      update: { $set: { localityCount: c.n } },
    },
  }));
  if (countOps.length) {
    await bulkInBatches("city counters", countOps, (chunk) =>
      City.bulkWrite(chunk, { ordered: false }),
    );
  }

  // --- Summary ---
  const [stateCount, cityCount, localityCount] = await Promise.all([
    State.countDocuments(),
    City.countDocuments(),
    Locality.countDocuments(),
  ]);

  console.log("\n──────────── SEED COMPLETE ────────────");
  console.log(`  States in DB:     ${stateCount.toLocaleString()}`);
  console.log(`  Cities in DB:     ${cityCount.toLocaleString()}`);
  console.log(`  Localities in DB: ${localityCount.toLocaleString()}`);
  console.log(`  (all seeded isActive:false; localities status:'approved')`);
  console.log("───────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n✖ Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
