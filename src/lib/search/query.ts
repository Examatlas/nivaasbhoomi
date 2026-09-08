import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Listing } from "@/lib/db/models/Listing";
import { fetchDealerCardInfo, rankRowsByDealerQuota } from "@/lib/listings/dealer-card-info";
import type { ListingCardData, ListingPurpose, PropertyType } from "@/types/listing";

const PORTAL_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/**
 * Site-wide search (DEV-SPEC.txt Sections 9, 10). EVERYTHING here is scoped to
 * isActive cities only - search must never surface an unlaunched city, a page
 * that would 404, or a listing whose city isn't public.
 */

/** Escape a user string for safe use inside a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface CityHit {
  name: string;
  slug: string;
}
export interface LocalityHit {
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
}

export interface SearchResults {
  query: string;
  /** A single strong destination match to redirect to, if any. */
  redirect?: string;
  cities: CityHit[];
  localities: LocalityHit[];
  listings: ListingCardData[];
}

export async function search(qRaw: string): Promise<SearchResults> {
  const query = qRaw.trim();
  if (!query) return { query: "", cities: [], localities: [], listings: [] };

  await connectDB();
  const rx = new RegExp(escapeRegex(query), "i");

  // Active cities are the universe for everything below.
  const activeCities = await City.find({ isActive: true }, { name: 1, slug: 1 }).lean();
  const activeCityIds = activeCities.map((c) => c._id);
  const cityById = new Map<string, { name: string; slug: string }>(
    activeCities.map((c) => [String(c._id), { name: c.name, slug: c.slug }]),
  );
  if (activeCities.length === 0) {
    return { query, cities: [], localities: [], listings: [] };
  }

  // Matching active cities.
  const cities: CityHit[] = activeCities
    .filter((c) => rx.test(c.name) || rx.test(c.slug))
    .map((c) => ({ name: c.name, slug: c.slug }));

  // Matching active localities within active cities.
  const localityRows = await Locality.find(
    { cityId: { $in: activeCityIds }, isActive: true, name: rx },
    { name: 1, slug: 1, cityId: 1 },
  )
    .limit(20)
    .lean();
  const localities: LocalityHit[] = localityRows.map((l) => {
    const c = cityById.get(String(l.cityId));
    return {
      name: l.name,
      slug: l.slug,
      citySlug: c?.slug ?? "",
      cityName: c?.name ?? "",
    };
  });

  // Strong destination match -> redirect. Exact (case-insensitive) city name or
  // slug wins; else an exact locality name.
  const qLower = query.toLowerCase();
  const exactCity = activeCities.find(
    (c) => c.name.toLowerCase() === qLower || c.slug === qLower,
  );
  let redirect: string | undefined;
  if (exactCity) {
    redirect = `/${exactCity.slug}`;
  } else {
    const exactLoc = localities.find((l) => l.name.toLowerCase() === qLower && l.citySlug);
    if (exactLoc) redirect = `/${exactLoc.citySlug}/${exactLoc.slug}`;
  }

  // Matching approved listings in active cities (title or locality name).
  const listings = await searchListings(rx, activeCityIds, cityById);

  return { query, redirect, cities, localities, listings };
}

async function searchListings(
  rx: RegExp,
  activeCityIds: mongoose.Types.ObjectId[],
  cityById: Map<string, { name: string; slug: string }>,
): Promise<ListingCardData[]> {
  // Localities whose name matches, so a search like "Kanke" also finds listings
  // there even if the title doesn't contain the term.
  const matchedLocalities = await Locality.find(
    { cityId: { $in: activeCityIds }, isActive: true, name: rx },
    { _id: 1 },
  ).lean();
  const localityIdMatch = matchedLocalities.map((l) => l._id);

  const rows = await Listing.find(
    {
      cityId: { $in: activeCityIds },
      status: "approved",
      slug: { $type: "string" },
      $or: [{ title: rx }, { localityId: { $in: localityIdMatch } }],
    },
    undefined,
    { sort: { lastRefreshedAt: -1 }, limit: 24 },
  ).lean();
  if (rows.length === 0) return [];

  const localityIds = [...new Set(rows.map((r) => String(r.localityId)))];
  const dealerIds = [...new Set(rows.map((r) => String(r.dealerId)))];
  const [localities, dealerInfo] = await Promise.all([
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
    fetchDealerCardInfo(dealerIds),
  ]);
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));

  // Quota-exhausted dealers' listings rank last (STEP 3.4).
  rankRowsByDealerQuota(rows, dealerInfo);

  return rows.map((l) => {
    const dealer = dealerInfo.get(String(l.dealerId));
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
      area: l.carpetArea ?? l.builtUpArea ?? l.superBuiltUpArea ?? l.plotArea ?? undefined,
      areaUnit: "sq.ft.",
      furnishing: l.furnishing ?? undefined,
      possessionStatus: l.possessionStatus ?? undefined,
      projectName: l.projectName ?? undefined,
      localityName: localityName.get(String(l.localityId)) ?? "",
      cityName: cityById.get(String(l.cityId))?.name ?? "",
      photo: cover,
      photos,
      photoCount: photos.length,
      badges: {
        documentsChecked: Boolean(l.badges?.documentsChecked),
        photosVerified: Boolean(l.badges?.photosVerified),
        siteVisited: Boolean(l.badges?.siteVisited),
      },
      verificationTier: dealer?.verificationTier ?? 0,
      zenithConnected: dealer?.zenithConnected ?? false,
      zenithNumber: dealer?.zenithNumber ?? null,
      refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
      whatsappNumber: PORTAL_WHATSAPP,
    } satisfies ListingCardData;
  });
}
