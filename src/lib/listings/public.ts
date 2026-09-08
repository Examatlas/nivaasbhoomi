import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Dealer } from "@/lib/db/models/Dealer";
import { State } from "@/lib/db/models/State";
import type { PublicListingDetail } from "@/types/property";
import type { ListingPurpose, PropertyType, Furnishing } from "@/types/listing";

/**
 * Resolve a listing by slug for the PUBLIC property page, applying the Section 9
 * visibility rules. Returns a discriminated result so the page can map each
 * outcome to the correct HTTP behaviour:
 *   not-found  -> notFound() (no doc, or a non-public status like pending/draft)
 *   deleted    -> 410 Gone
 *   expired    -> 301/308 redirect to the locality page
 *   ok         -> render
 */
export type PublicListingResult =
  | { kind: "ok"; listing: PublicListingDetail }
  | { kind: "expired"; localityPath: string }
  | { kind: "deleted" }
  | { kind: "not-found" };

const PORTAL_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export async function getPublicListing(slug: string): Promise<PublicListingResult> {
  await connectDB();

  const l = await Listing.findOne({ slug }).lean();
  if (!l) return { kind: "not-found" };

  if (l.status === "deleted") return { kind: "deleted" };

  // For expired listings, redirect to the locality page (Section 9).
  const [city, locality] = await Promise.all([
    City.findById(l.cityId, { name: 1, slug: 1 }).lean(),
    Locality.findById(l.localityId, { name: 1, slug: 1 }).lean(),
  ]);

  if (l.status === "expired") {
    if (city?.slug && locality?.slug) {
      return { kind: "expired", localityPath: `/${city.slug}/${locality.slug}` };
    }
    return { kind: "not-found" };
  }

  // Only approved listings are public.
  if (l.status !== "approved") return { kind: "not-found" };
  if (!city || !locality) return { kind: "not-found" };

  const [dealer, state, reraState] = await Promise.all([
    // Seed listings have dealerId=null — skip the lookup (renders no dealer section).
    isValidObjectId(l.dealerId)
      ? Dealer.findById(l.dealerId, {
          slug: 1,
          businessName: 1,
          verificationTier: 1,
          rating: 1,
          ratingCount: 1,
          avgResponseMinutes: 1,
          zenithConnected: 1,
          zenithNumber: 1,
        }).lean()
      : null,
    l.stateId ? State.findById(l.stateId, { name: 1 }).lean() : null,
    l.reraStateId ? State.findById(l.reraStateId, { name: 1 }).lean() : null,
  ]);

  // Map ONLY public-safe fields. fullAddress and dealer phone/email are never
  // read here (Section 13 privacy).
  const listing: PublicListingDetail = {
    id: String(l._id),
    slug: l.slug!,
    title: l.title!,
    description: l.description ?? "",
    purpose: l.purpose as ListingPurpose,
    propertyType: l.propertyType as PropertyType,
    isCntLand: Boolean(l.isCntLand),

    price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? 0,
    pricePerSqft: l.pricePerSqft ?? undefined,
    priceNegotiable:
      (l.purpose === "rent" ? l.rentNegotiable : l.priceNegotiable) ?? undefined,
    bookingAmount: l.bookingAmount ?? undefined,
    securityDeposit: l.securityDeposit ?? undefined,
    maintenanceCharge: l.maintenanceCharge ?? undefined,
    brokerage: l.brokerage ?? undefined,
    preferredTenant: l.preferredTenant?.length ? l.preferredTenant : undefined,
    availableFrom: l.availableFrom ? l.availableFrom.toISOString() : undefined,
    minLeasePeriod: l.minLeasePeriod ?? undefined,

    bhk: l.bhk ?? undefined,
    bathrooms: l.bathrooms ?? undefined,
    balconies: l.balconies ?? undefined,
    carpetArea: l.carpetArea ?? undefined,
    builtUpArea: l.builtUpArea ?? undefined,
    superBuiltUpArea: l.superBuiltUpArea ?? undefined,
    plotArea: l.plotArea ?? undefined,
    floor: l.floor ?? undefined,
    totalFloors: l.totalFloors ?? undefined,
    facing: l.facing ?? undefined,
    ageOfProperty: l.ageOfProperty ?? undefined,

    furnishing: (l.furnishing as Furnishing | undefined) ?? undefined,
    furnishingDetails: l.furnishingDetails?.length ? l.furnishingDetails : undefined,
    amenities: l.amenities?.length ? l.amenities : undefined,
    parking: l.parking ?? undefined,
    waterSource: l.waterSource?.length ? l.waterSource : undefined,

    possessionStatus: l.possessionStatus ?? undefined,
    possessionDate: l.possessionDate ? l.possessionDate.toISOString() : undefined,
    ownershipType: l.ownershipType ?? undefined,
    reraNumber: l.reraNumber ?? undefined,
    reraStateName: reraState?.name ?? undefined,
    approvedBy: l.approvedBy?.length ? l.approvedBy : undefined,

    localityName: locality.name,
    localitySlug: locality.slug,
    localityId: String(l.localityId),
    cityName: city.name,
    citySlug: city.slug,
    cityId: String(l.cityId),
    stateName: state?.name ?? undefined,
    isSeed: Boolean(l.isSeed),
    subLocality: l.subLocality ?? undefined,
    projectName: l.projectName ?? undefined,
    landmark: l.landmark ?? undefined,
    lat: l.lat ?? undefined,
    lng: l.lng ?? undefined,

    photos: (l.photos ?? []).map((p) => ({
      url: p.url!,
      publicId: p.publicId ?? undefined,
      width: p.width ?? 1200,
      height: p.height ?? 900,
    })),
    coverPhotoIndex: l.coverPhotoIndex ?? 0,
    video: l.video?.url
      ? {
          url: l.video.url,
          publicId: l.video.publicId ?? undefined,
          duration: l.video.duration ?? undefined,
        }
      : undefined,
    floorPlan: l.floorPlan?.url
      ? { url: l.floorPlan.url, publicId: l.floorPlan.publicId ?? undefined }
      : undefined,

    badges: {
      documentsChecked: Boolean(l.badges?.documentsChecked),
      photosVerified: Boolean(l.badges?.photosVerified),
      siteVisited: Boolean(l.badges?.siteVisited),
    },
    dealer: dealer
      ? {
          slug: dealer.slug ?? null,
          businessName: dealer.businessName,
          verificationTier: dealer.verificationTier ?? 0,
          rating: dealer.rating ?? 0,
          ratingCount: dealer.ratingCount ?? 0,
          avgResponseMinutes: dealer.avgResponseMinutes ?? undefined,
          zenithConnected: Boolean(dealer.zenithConnected),
          zenithNumber: dealer.zenithConnected ? (dealer.zenithNumber ?? null) : null,
        }
      : null,

    refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
    whatsappNumber: PORTAL_WHATSAPP,
  };

  return { kind: "ok", listing };
}

/** Slugs of all approved listings, for generateStaticParams. */
export async function getApprovedListingSlugs(limit = 5000): Promise<string[]> {
  await connectDB();
  const rows = await Listing.find(
    { status: "approved", slug: { $type: "string" } },
    { slug: 1 },
  )
    .limit(limit)
    .lean();
  return rows.map((r) => r.slug!).filter(Boolean);
}
