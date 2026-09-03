import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Listing } from "@/lib/db/models/Listing";
import type { ListingCardData, ListingPurpose, PropertyType } from "@/types/listing";

const PORTAL_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/**
 * Public agent (dealer) profile (DEV-SPEC.txt Sections 10, 13).
 *
 * PRIVACY (hard rule): this shape carries ONLY the public fields Section 13
 * permits - businessName, slug, profilePhoto, verificationTier, rating,
 * ratingCount, coverage city NAMES, listing count, avgResponseMinutes. It never
 * includes phone, email, documents, name, or any internal field. Callers render
 * straight from this object, so a private field can't leak by accident.
 */
export interface AgentProfile {
  slug: string;
  businessName: string;
  profilePhoto?: string;
  verificationTier: number;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  /** Active coverage cities, resolved to display names (+ slug for linking). */
  coverageCities: { name: string; slug: string }[];
  listingCount: number;
  listings: ListingCardData[];
  /** When the profile itself last changed - used for metadata only. */
  updatedAt: string;
}

/**
 * Resolve a public agent profile by slug, or null (404). A banned dealer or one
 * with no public slug does not resolve.
 */
export async function getAgentProfile(slug: string): Promise<AgentProfile | null> {
  await connectDB();

  const dealer = await Dealer.findOne(
    { slug, status: { $ne: "banned" } },
    {
      // Explicit projection: only ever pull public fields out of the DB.
      slug: 1,
      businessName: 1,
      profilePhoto: 1,
      verificationTier: 1,
      rating: 1,
      ratingCount: 1,
      avgResponseMinutes: 1,
      coverageCities: 1,
      updatedAt: 1,
    },
  ).lean();
  if (!dealer) return null;

  const dealerId = dealer._id as mongoose.Types.ObjectId;

  // Coverage cities -> names, active only (an inactive city has no public page).
  const coverageIds = (dealer.coverageCities ?? []).map((c) =>
    typeof c === "object" ? c : new mongoose.Types.ObjectId(String(c)),
  );
  const coverageCities =
    coverageIds.length > 0
      ? (
          await City.find(
            { _id: { $in: coverageIds }, isActive: true },
            { name: 1, slug: 1 },
          )
            .sort({ name: 1 })
            .lean()
        ).map((c) => ({ name: c.name, slug: c.slug }))
      : [];

  // This dealer's approved listings, as PropertyCard data.
  const rows = await Listing.find(
    { dealerId, status: "approved", slug: { $type: "string" } },
    undefined,
    { sort: { lastRefreshedAt: -1 } },
  ).lean();

  let listings: ListingCardData[] = [];
  if (rows.length > 0) {
    const localityIds = [...new Set(rows.map((r) => String(r.localityId)))];
    const cityIds = [...new Set(rows.map((r) => String(r.cityId)))];
    const [localities, cities] = await Promise.all([
      Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
      City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    ]);
    const localityName = new Map(localities.map((l) => [String(l._id), l.name]));
    const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
    const tier = dealer.verificationTier ?? 0;

    listings = rows.map((l) => {
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
        verificationTier: tier,
        refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
        whatsappNumber: PORTAL_WHATSAPP,
      } satisfies ListingCardData;
    });
  }

  return {
    slug: dealer.slug!,
    businessName: dealer.businessName,
    profilePhoto: dealer.profilePhoto ?? undefined,
    verificationTier: dealer.verificationTier ?? 0,
    rating: dealer.rating ?? 0,
    ratingCount: dealer.ratingCount ?? 0,
    avgResponseMinutes: dealer.avgResponseMinutes ?? undefined,
    coverageCities,
    listingCount: listings.length,
    listings,
    updatedAt: (dealer.updatedAt ?? new Date()).toISOString(),
  };
}

/** Active dealer slugs with a public profile (agent generateStaticParams). */
export async function getAgentStaticParams(): Promise<{ slug: string }[]> {
  await connectDB();
  const rows = await Dealer.find(
    { slug: { $type: "string" }, status: { $ne: "banned" } },
    { slug: 1 },
  ).lean();
  return rows.map((d) => ({ slug: d.slug! }));
}
