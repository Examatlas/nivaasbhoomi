import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { slugify } from "@/lib/utils/slug";
import { generateDealerSlug, RESERVED_DEALER_SLUGS } from "@/lib/dealers/slug";

/**
 * Server-side dealer-slug operations: unique generation (DB-backed), an
 * availability check for the live edit field, and the 301 redirect resolver for
 * old slugs. The pure rules live in ./slug; this file adds the DB.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every slug (current + historical) beginning with `prefix`, across all dealers. */
async function takenSlugsWithPrefix(prefix: string): Promise<Set<string>> {
  if (!prefix) return new Set();
  const rx = new RegExp(`^${escapeRegex(prefix)}`);
  const dealers = await Dealer.find(
    { $or: [{ slug: rx }, { slugHistory: rx }] },
    { slug: 1, slugHistory: 1 },
  ).lean();
  const set = new Set<string>();
  for (const d of dealers) {
    if (d.slug) set.add(d.slug);
    for (const h of d.slugHistory ?? []) set.add(h);
  }
  return set;
}

/**
 * Generate a unique slug from the dealer's business name + primary coverage
 * locality/city. Used at onboarding once coverage exists.
 */
export async function generateDealerSlugFromCoverage(dealer: {
  businessName: string;
  coverageLocalities?: unknown[];
  coverageCities?: unknown[];
}): Promise<string> {
  await connectDB();

  let localityName: string | null = null;
  let cityName: string | null = null;

  const primaryLocalityId = dealer.coverageLocalities?.[0]
    ? String(dealer.coverageLocalities[0])
    : null;
  const primaryCityId = dealer.coverageCities?.[0] ? String(dealer.coverageCities[0]) : null;

  if (primaryLocalityId) {
    const loc = await Locality.findById(primaryLocalityId, { name: 1, cityId: 1 }).lean();
    localityName = loc?.name ?? null;
    const cityId = loc?.cityId ? String(loc.cityId) : primaryCityId;
    if (cityId) {
      const c = await City.findById(cityId, { name: 1 }).lean();
      cityName = c?.name ?? null;
    }
  } else if (primaryCityId) {
    const c = await City.findById(primaryCityId, { name: 1 }).lean();
    cityName = c?.name ?? null;
  }

  const prefix = slugify(dealer.businessName);
  const taken = await takenSlugsWithPrefix(prefix);
  return generateDealerSlug({
    businessName: dealer.businessName,
    localityName,
    cityName,
    isTaken: (s) => taken.has(s),
  });
}

/**
 * Is `slug` free for `dealerId` to take? Free = not reserved AND not held by any
 * OTHER dealer as its current slug or anywhere in its slug history (old slugs
 * stay owned forever so their 301s never break).
 */
export async function isDealerSlugAvailable(slug: string, dealerId: string): Promise<boolean> {
  if (RESERVED_DEALER_SLUGS.has(slug)) return false;
  await connectDB();
  const clash = await Dealer.findOne(
    { _id: { $ne: dealerId }, $or: [{ slug }, { slugHistory: slug }] },
    { _id: 1 },
  ).lean();
  return !clash;
}

/**
 * If `slug` is an OLD slug of some dealer (and differs from their current one),
 * return the CURRENT slug to 301 to; else null. Callers resolve the current slug
 * first, so this can never produce a self-redirect (loop-safe).
 */
export async function resolveDealerSlugRedirect(slug: string): Promise<string | null> {
  await connectDB();
  const dealer = await Dealer.findOne(
    { slugHistory: slug, slug: { $ne: slug }, status: { $ne: "banned" } },
    { slug: 1 },
  ).lean();
  return dealer?.slug ?? null;
}
