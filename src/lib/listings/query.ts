import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Dealer } from "@/lib/db/models/Dealer";
import type { FilterQuery } from "@/lib/filters/parse";
import { filterToSegment } from "@/lib/filters/segment";
import type { ListingCardData, ListingPurpose, PropertyType } from "@/types/listing";

/** Minimum approved listings for a locality/filter page to be indexable (S10). */
export const THIN_PAGE_MIN = 3;

const PORTAL_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export interface ResolvedLocality {
  city: { id: string; name: string; slug: string };
  locality: {
    id: string;
    name: string;
    slug: string;
    introText?: string;
    connectivity?: string;
    faq: { question: string; answer: string }[];
  };
}

/**
 * Resolve a city + ACTIVE locality by slug, or null (Section 9 404s).
 *
 * Only the LOCALITY must be active - the locality/filter pages are the SEO
 * long-tail and go live per-locality (auto-activated at 3 listings + 500-char
 * intro), independent of the city's overall launch (which is separately gated
 * by the 25/5/3 guard and controls only the city page). This matches Section
 * 10's generateStaticParams thin-page guards, which key locality pages on the
 * locality's listing count, not on city activation.
 */
export async function resolveActiveCityLocality(
  citySlug: string,
  localitySlug: string,
): Promise<ResolvedLocality | null> {
  await connectDB();

  const city = await City.findOne({ slug: citySlug }, { name: 1, slug: 1 }).lean();
  if (!city) return null;

  const locality = await Locality.findOne(
    { cityId: city._id, slug: localitySlug, isActive: true },
    { name: 1, slug: 1, introText: 1, connectivity: 1, faq: 1 },
  ).lean();
  if (!locality) return null;

  return {
    city: { id: String(city._id), name: city.name, slug: city.slug },
    locality: {
      id: String(locality._id),
      name: locality.name,
      slug: locality.slug,
      introText: locality.introText ?? undefined,
      connectivity: locality.connectivity ?? undefined,
      faq: (locality.faq ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    },
  };
}

/** Mongo query for approved listings in a locality, narrowed by an optional filter. */
function buildQuery(localityId: mongoose.Types.ObjectId, f?: FilterQuery) {
  const q: Record<string, unknown> = { localityId, status: "approved" };
  if (f?.propertyType) q.propertyType = f.propertyType;
  if (f?.bhk) q.bhk = f.bhk;
  if (f?.purpose) q.purpose = f.purpose;
  if (f?.furnishing) q.furnishing = f.furnishing;
  // Budget (no purpose in Section 9) applies to the sale price.
  if (f?.maxPrice != null) q.expectedPrice = { $lte: f.maxPrice };
  return q;
}

/** Count approved listings matching a locality (+ optional filter) - thin-page guard. */
export async function countApproved(
  localityId: string,
  f?: FilterQuery,
): Promise<number> {
  await connectDB();
  return Listing.countDocuments(buildQuery(new mongoose.Types.ObjectId(localityId), f));
}

export interface CardSort {
  field: "createdAt" | "expectedPrice" | "monthlyRent";
  dir: 1 | -1;
}

/** Fetch approved listings as PropertyCard data, newest first by default. */
export async function fetchApprovedCards(params: {
  localityId: string;
  cityName: string;
  localityName: string;
  filter?: FilterQuery;
  sort?: CardSort;
  limit?: number;
}): Promise<ListingCardData[]> {
  await connectDB();
  const { localityId, cityName, localityName, filter, sort, limit = 60 } = params;

  const rows = await Listing.find(
    buildQuery(new mongoose.Types.ObjectId(localityId), filter),
  )
    .sort(sort ? { [sort.field]: sort.dir } : { lastRefreshedAt: -1 })
    .limit(limit)
    .lean();

  // Batch dealer tiers (verification badge) - never expose phone/name.
  const dealerIds = [...new Set(rows.map((r) => String(r.dealerId)))];
  const dealers = await Dealer.find(
    { _id: { $in: dealerIds } },
    { verificationTier: 1 },
  ).lean();
  const tierById = new Map(dealers.map((d) => [String(d._id), d.verificationTier ?? 0]));

  return rows.map((l) => {
    const photos = (l.photos ?? []).map((p) => ({
      url: p.url!,
      publicId: p.publicId ?? undefined,
      width: p.width ?? 1200,
      height: p.height ?? 900,
    }));
    const cover = photos[l.coverPhotoIndex ?? 0] ?? photos[0];
    return {
      id: String(l._id),
      slug: l.slug!,
      title: l.title!,
      purpose: l.purpose as ListingPurpose,
      propertyType: l.propertyType as PropertyType,
      price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? 0,
      bhk: l.bhk ?? undefined,
      area: l.carpetArea ?? l.builtUpArea ?? l.plotArea ?? undefined,
      areaUnit: "sq.ft.",
      furnishing: l.furnishing ?? undefined,
      localityName,
      cityName,
      photo: cover,
      photos,
      photoCount: photos.length,
      badges: {
        documentsChecked: Boolean(l.badges?.documentsChecked),
        photosVerified: Boolean(l.badges?.photosVerified),
        siteVisited: Boolean(l.badges?.siteVisited),
      },
      verificationTier: tierById.get(String(l.dealerId)) ?? 0,
      refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
      whatsappNumber: PORTAL_WHATSAPP,
    } satisfies ListingCardData;
  });
}

export interface RateRange {
  saleMin?: number;
  saleMax?: number;
  rentMin?: number;
  rentMax?: number;
  avgPricePerSqft?: number;
}

/** Auto-calculated rate range from approved listings in a locality (Section 10). */
export async function computeRateRange(localityId: string): Promise<RateRange> {
  await connectDB();
  const _id = new mongoose.Types.ObjectId(localityId);

  const [sale] = await Listing.aggregate<{ min: number; max: number; avgPsf: number }>([
    {
      $match: {
        localityId: _id,
        status: "approved",
        purpose: "sale",
        expectedPrice: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        min: { $min: "$expectedPrice" },
        max: { $max: "$expectedPrice" },
        avgPsf: { $avg: "$pricePerSqft" },
      },
    },
  ]);
  const [rent] = await Listing.aggregate<{ min: number; max: number }>([
    {
      $match: {
        localityId: _id,
        status: "approved",
        purpose: "rent",
        monthlyRent: { $gt: 0 },
      },
    },
    {
      $group: { _id: null, min: { $min: "$monthlyRent" }, max: { $max: "$monthlyRent" } },
    },
  ]);

  return {
    saleMin: sale?.min,
    saleMax: sale?.max,
    rentMin: rent?.min,
    rentMax: rent?.max,
    avgPricePerSqft: sale?.avgPsf ? Math.round(sale.avgPsf) : undefined,
  };
}

/** Other active localities in the same city, for internal linking. */
export async function getRelatedLocalities(
  cityId: string,
  excludeLocalityId: string,
  limit = 8,
): Promise<{ name: string; slug: string }[]> {
  await connectDB();
  const rows = await Locality.find(
    {
      cityId: new mongoose.Types.ObjectId(cityId),
      isActive: true,
      _id: { $ne: new mongoose.Types.ObjectId(excludeLocalityId) },
    },
    { name: 1, slug: 1 },
  )
    .sort({ listingCount: -1, name: 1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({ name: r.name, slug: r.slug }));
}

// ---- generateStaticParams (thin-page guard, Section 10) ----

/** Localities with >= 3 approved listings (in active cities) -> locality params. */
export async function getStaticLocalityParams(): Promise<
  { city: string; locality: string }[]
> {
  await connectDB();

  const grouped = await Listing.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { status: "approved" } },
    { $group: { _id: "$localityId", n: { $sum: 1 } } },
    { $match: { n: { $gte: THIN_PAGE_MIN } } },
  ]);
  const ids = grouped.map((g) => g._id);
  if (ids.length === 0) return [];

  const localities = await Locality.find(
    { _id: { $in: ids }, isActive: true },
    { slug: 1, cityId: 1 },
  ).lean();
  const cityIds = [...new Set(localities.map((l) => String(l.cityId)))];
  // City need not be active - locality pages are independent of city launch.
  const cities = await City.find({ _id: { $in: cityIds } }, { slug: 1 }).lean();
  const citySlug = new Map(cities.map((c) => [String(c._id), c.slug]));

  const params: { city: string; locality: string }[] = [];
  for (const l of localities) {
    const cs = citySlug.get(String(l.cityId));
    if (cs) params.push({ city: cs, locality: l.slug });
  }
  return params;
}

/** Filter combinations with >= 3 approved matches -> filter params (excl. budget). */
export async function getStaticFilterParams(): Promise<
  { city: string; locality: string; filter: string }[]
> {
  await connectDB();

  // Map qualifying localities -> { citySlug, localitySlug }.
  const base = await getStaticLocalityParams();
  const localitySlugToCity = new Map(base.map((b) => [b.locality, b.city]));
  // Resolve localityId -> slug for the aggregation join.
  const activeLocalities = await Locality.find(
    { slug: { $in: base.map((b) => b.locality) }, isActive: true },
    { slug: 1 },
  ).lean();
  const slugById = new Map(activeLocalities.map((l) => [String(l._id), l.slug]));
  const idSet = activeLocalities.map((l) => l._id);
  if (idSet.length === 0) return [];

  const match = { status: "approved", localityId: { $in: idSet } };

  // One aggregation per supported (non-budget) shape.
  const groupings: {
    key: Record<string, string>;
    toFilter: (r: Record<string, string>) => FilterQuery | null;
  }[] = [
    {
      key: { localityId: "$localityId", propertyType: "$propertyType" },
      toFilter: (r) => ({ propertyType: r.propertyType! }),
    },
    {
      key: { localityId: "$localityId", bhk: "$bhk", propertyType: "$propertyType" },
      toFilter: (r) => (r.bhk ? { propertyType: r.propertyType!, bhk: r.bhk } : null),
    },
    {
      key: {
        localityId: "$localityId",
        propertyType: "$propertyType",
        purpose: "$purpose",
      },
      toFilter: (r) => ({
        propertyType: r.propertyType!,
        purpose: r.purpose as "sale" | "rent",
      }),
    },
    {
      key: {
        localityId: "$localityId",
        bhk: "$bhk",
        propertyType: "$propertyType",
        purpose: "$purpose",
      },
      toFilter: (r) =>
        r.bhk
          ? {
              propertyType: r.propertyType!,
              bhk: r.bhk,
              purpose: r.purpose as "sale" | "rent",
            }
          : null,
    },
    {
      key: {
        localityId: "$localityId",
        furnishing: "$furnishing",
        propertyType: "$propertyType",
        purpose: "$purpose",
      },
      toFilter: (r) =>
        r.furnishing
          ? {
              propertyType: r.propertyType!,
              furnishing: r.furnishing as FilterQuery["furnishing"],
              purpose: r.purpose as "sale" | "rent",
            }
          : null,
    },
  ];

  const out: { city: string; locality: string; filter: string }[] = [];
  const seen = new Set<string>();

  for (const g of groupings) {
    const rows = await Listing.aggregate<{ _id: Record<string, unknown>; n: number }>([
      { $match: match },
      { $group: { _id: g.key, n: { $sum: 1 } } },
      { $match: { n: { $gte: THIN_PAGE_MIN } } },
    ]);
    for (const row of rows) {
      const raw = row._id as Record<string, unknown>;
      const localitySlug = slugById.get(String(raw.localityId));
      if (!localitySlug) continue;
      const citySlug = localitySlugToCity.get(localitySlug);
      if (!citySlug) continue;
      const fq = g.toFilter({
        propertyType: String(raw.propertyType ?? ""),
        bhk: raw.bhk ? String(raw.bhk) : "",
        purpose: raw.purpose ? String(raw.purpose) : "",
        furnishing: raw.furnishing ? String(raw.furnishing) : "",
      });
      if (!fq) continue;
      const segment = filterToSegment(fq);
      if (!segment) continue;
      const key = `${citySlug}/${localitySlug}/${segment}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ city: citySlug, locality: localitySlug, filter: segment });
    }
  }
  return out;
}

/**
 * Recent approved listings across the whole portal, for the home page's
 * "Featured" grid. Resolves each listing's city + locality name in bulk and
 * exposes dealer verification tier - never dealer phone/name (Section 13).
 */
export async function getFeaturedListings(limit = 8): Promise<ListingCardData[]> {
  await connectDB();

  // Only surface listings from LAUNCHED (active) cities on the home page.
  const activeCityIds = (await City.find({ isActive: true }, { _id: 1 }).lean()).map(
    (c) => c._id,
  );
  if (activeCityIds.length === 0) return [];

  const rows = await Listing.find({
    status: "approved",
    slug: { $type: "string" },
    cityId: { $in: activeCityIds },
  })
    .sort({ lastRefreshedAt: -1 })
    .limit(limit)
    .lean();
  if (rows.length === 0) return [];

  const cityIds = [...new Set(rows.map((r) => String(r.cityId)))];
  const localityIds = [...new Set(rows.map((r) => String(r.localityId)))];
  const dealerIds = [...new Set(rows.map((r) => String(r.dealerId)))];

  const [cities, localities, dealers] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
    Dealer.find({ _id: { $in: dealerIds } }, { verificationTier: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));
  const tierById = new Map(dealers.map((d) => [String(d._id), d.verificationTier ?? 0]));

  return rows.map((l) => {
    const photos = (l.photos ?? []).map((p) => ({
      url: p.url!,
      publicId: p.publicId ?? undefined,
      width: p.width ?? 1200,
      height: p.height ?? 900,
    }));
    const cover = photos[l.coverPhotoIndex ?? 0] ?? photos[0];
    return {
      id: String(l._id),
      slug: l.slug!,
      title: l.title!,
      purpose: l.purpose as ListingPurpose,
      propertyType: l.propertyType as PropertyType,
      price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? 0,
      bhk: l.bhk ?? undefined,
      area: l.carpetArea ?? l.builtUpArea ?? l.plotArea ?? undefined,
      areaUnit: "sq.ft.",
      furnishing: l.furnishing ?? undefined,
      localityName: localityName.get(String(l.localityId)) ?? "",
      cityName: cityName.get(String(l.cityId)) ?? "",
      photo: cover,
      photos,
      photoCount: photos.length,
      badges: {
        documentsChecked: Boolean(l.badges?.documentsChecked),
        photosVerified: Boolean(l.badges?.photosVerified),
        siteVisited: Boolean(l.badges?.siteVisited),
      },
      verificationTier: tierById.get(String(l.dealerId)) ?? 0,
      refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
      whatsappNumber: PORTAL_WHATSAPP,
    } satisfies ListingCardData;
  });
}

// ---- City page ----

export interface ResolvedCity {
  id: string;
  name: string;
  slug: string;
  introText?: string;
  faq: { question: string; answer: string }[];
}

/** Resolve an ACTIVE city by slug, or null (Section 9: inactive city -> 404). */
export async function resolveActiveCity(citySlug: string): Promise<ResolvedCity | null> {
  await connectDB();
  const city = await City.findOne(
    { slug: citySlug, isActive: true },
    { name: 1, slug: 1, introText: 1, faq: 1 },
  ).lean();
  if (!city) return null;
  return {
    id: String(city._id),
    name: city.name,
    slug: city.slug,
    introText: city.introText ?? undefined,
    faq: (city.faq ?? []).map((f) => ({ question: f.question, answer: f.answer })),
  };
}

/** Approved-listing rate range across a whole city. */
export async function computeCityRateRange(cityId: string): Promise<RateRange> {
  await connectDB();
  const _id = new mongoose.Types.ObjectId(cityId);
  const [sale] = await Listing.aggregate<{ min: number; max: number; avgPsf: number }>([
    {
      $match: {
        cityId: _id,
        status: "approved",
        purpose: "sale",
        expectedPrice: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        min: { $min: "$expectedPrice" },
        max: { $max: "$expectedPrice" },
        avgPsf: { $avg: "$pricePerSqft" },
      },
    },
  ]);
  const [rent] = await Listing.aggregate<{ min: number; max: number }>([
    {
      $match: {
        cityId: _id,
        status: "approved",
        purpose: "rent",
        monthlyRent: { $gt: 0 },
      },
    },
    {
      $group: { _id: null, min: { $min: "$monthlyRent" }, max: { $max: "$monthlyRent" } },
    },
  ]);
  return {
    saleMin: sale?.min,
    saleMax: sale?.max,
    rentMin: rent?.min,
    rentMax: rent?.max,
    avgPricePerSqft: sale?.avgPsf ? Math.round(sale.avgPsf) : undefined,
  };
}

/** Popular localities in a city: active localities with the most listings. */
export async function getCityPopularLocalities(
  cityId: string,
  limit = 12,
): Promise<{ name: string; slug: string; listingCount: number }[]> {
  await connectDB();
  const rows = await Locality.find(
    { cityId: new mongoose.Types.ObjectId(cityId), isActive: true },
    { name: 1, slug: 1, listingCount: 1 },
  )
    .sort({ listingCount: -1, name: 1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    listingCount: r.listingCount ?? 0,
  }));
}

/** Count approved listings in a city. */
export async function countApprovedInCity(cityId: string): Promise<number> {
  await connectDB();
  return Listing.countDocuments({
    cityId: new mongoose.Types.ObjectId(cityId),
    status: "approved",
  });
}

/** Newest approved listings in a city, as PropertyCard data. */
export async function getCityListings(
  cityId: string,
  cityName: string,
  limit = 12,
): Promise<ListingCardData[]> {
  await connectDB();
  const rows = await Listing.find({
    cityId: new mongoose.Types.ObjectId(cityId),
    status: "approved",
    slug: { $type: "string" },
  })
    .sort({ lastRefreshedAt: -1 })
    .limit(limit)
    .lean();
  if (rows.length === 0) return [];

  const localityIds = [...new Set(rows.map((r) => String(r.localityId)))];
  const dealerIds = [...new Set(rows.map((r) => String(r.dealerId)))];
  const [localities, dealers] = await Promise.all([
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
    Dealer.find({ _id: { $in: dealerIds } }, { verificationTier: 1 }).lean(),
  ]);
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));
  const tierById = new Map(dealers.map((d) => [String(d._id), d.verificationTier ?? 0]));

  return rows.map((l) => {
    const photos = (l.photos ?? []).map((p) => ({
      url: p.url!,
      publicId: p.publicId ?? undefined,
      width: p.width ?? 1200,
      height: p.height ?? 900,
    }));
    const cover = photos[l.coverPhotoIndex ?? 0] ?? photos[0];
    return {
      id: String(l._id),
      slug: l.slug!,
      title: l.title!,
      purpose: l.purpose as ListingPurpose,
      propertyType: l.propertyType as PropertyType,
      price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? 0,
      bhk: l.bhk ?? undefined,
      area: l.carpetArea ?? l.builtUpArea ?? l.plotArea ?? undefined,
      areaUnit: "sq.ft.",
      furnishing: l.furnishing ?? undefined,
      localityName: localityName.get(String(l.localityId)) ?? "",
      cityName,
      photo: cover,
      photos,
      photoCount: photos.length,
      badges: {
        documentsChecked: Boolean(l.badges?.documentsChecked),
        photosVerified: Boolean(l.badges?.photosVerified),
        siteVisited: Boolean(l.badges?.siteVisited),
      },
      verificationTier: tierById.get(String(l.dealerId)) ?? 0,
      refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
      whatsappNumber: PORTAL_WHATSAPP,
    } satisfies ListingCardData;
  });
}

/** All active cities (home selector + city generateStaticParams). */
export async function getActiveCities(): Promise<
  { name: string; slug: string; tier: number; listingCount: number }[]
> {
  await connectDB();
  const rows = await City.find(
    { isActive: true },
    { name: 1, slug: 1, tier: 1, listingCount: 1 },
  )
    .sort({ tier: 1, name: 1 })
    .lean();
  return rows.map((c) => ({
    name: c.name,
    slug: c.slug,
    tier: c.tier ?? 3,
    listingCount: c.listingCount ?? 0,
  }));
}
