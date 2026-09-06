import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Listing } from "@/lib/db/models/Listing";
import { sanitizeAbout } from "@/lib/security/sanitize";
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
export interface WorkingHours {
  day: string;
  open?: string;
  close?: string;
  closed: boolean;
}

export interface AgentProfile {
  /** Dealer id — an opaque handle used only to POST a direct profile enquiry. */
  id: string;
  slug: string;
  businessName: string;
  profilePhoto?: string;
  logoImage?: string;
  bannerImage?: string;
  tagline?: string;
  /** Sanitized rich-text HTML (safe to render). */
  about?: string;
  establishedYear?: number;
  yearsExperience?: number;
  teamSize?: number;
  dealTypes: string[];
  languages: string[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  reraNumber?: string;
  gstNumber?: string;
  officeAddress?: string;
  mapLat?: number;
  mapLng?: number;
  workingHours: WorkingHours[];
  /** Only present when the dealer opted in to show it publicly. */
  publicEmail?: string;
  publicPhone?: string;
  verificationTier: number;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  /** Active coverage cities, resolved to display names (+ slug for linking). */
  coverageCities: { name: string; slug: string }[];
  /** Active coverage localities (service areas), name + city slug for linking. */
  serviceLocalities: { name: string; citySlug: string; localitySlug: string }[];
  /** Zenith automation — drives the WhatsApp-vs-Contact CTA (safe, no tokens). */
  zenithConnected: boolean;
  zenithNumber: string | null;
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
      logoImage: 1,
      bannerImage: 1,
      tagline: 1,
      about: 1,
      establishedYear: 1,
      yearsExperience: 1,
      teamSize: 1,
      dealTypes: 1,
      languages: 1,
      priceRangeMin: 1,
      priceRangeMax: 1,
      reraNumber: 1,
      gstNumber: 1,
      officeAddress: 1,
      mapLat: 1,
      mapLng: 1,
      workingHours: 1,
      publicEmail: 1,
      publicEmailOptIn: 1,
      publicPhoneOptIn: 1,
      phone: 1, // shown only if publicPhoneOptIn (below)
      verificationTier: 1,
      rating: 1,
      ratingCount: 1,
      avgResponseMinutes: 1,
      coverageCities: 1,
      coverageLocalities: 1,
      updatedAt: 1,
      zenithConnected: 1,
      zenithNumber: 1,
      // NB: verificationDocs, zenith tokens/orgId, passwordHash are NEVER projected.
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

  // Service areas = active coverage localities, resolved with their city slug.
  const localityIds = (dealer.coverageLocalities ?? []).map((l) =>
    typeof l === "object" ? l : new mongoose.Types.ObjectId(String(l)),
  );
  let serviceLocalities: AgentProfile["serviceLocalities"] = [];
  if (localityIds.length > 0) {
    const locs = await Locality.find(
      { _id: { $in: localityIds }, isActive: true },
      { name: 1, slug: 1, cityId: 1 },
    )
      .sort({ name: 1 })
      .lean();
    const locCityIds = [...new Set(locs.map((l) => String(l.cityId)))];
    const locCities = await City.find(
      { _id: { $in: locCityIds } },
      { slug: 1 },
    ).lean();
    const citySlugById = new Map(locCities.map((c) => [String(c._id), c.slug]));
    serviceLocalities = locs.map((l) => ({
      name: l.name,
      citySlug: citySlugById.get(String(l.cityId)) ?? "",
      localitySlug: l.slug ?? "",
    }));
  }

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
    const zenithConnected = Boolean(dealer.zenithConnected);
    const zenithNumber = zenithConnected ? (dealer.zenithNumber ?? null) : null;

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
        zenithConnected,
        zenithNumber,
        refreshedAt: (l.lastRefreshedAt ?? l.createdAt ?? new Date()).toISOString(),
        whatsappNumber: PORTAL_WHATSAPP,
      } satisfies ListingCardData;
    });
  }

  return {
    id: String(dealerId),
    slug: dealer.slug!,
    businessName: dealer.businessName,
    profilePhoto: dealer.profilePhoto ?? undefined,
    logoImage: dealer.logoImage?.url ?? undefined,
    bannerImage: dealer.bannerImage?.url ?? undefined,
    tagline: dealer.tagline ?? undefined,
    about: dealer.about ? sanitizeAbout(dealer.about) : undefined,
    establishedYear: dealer.establishedYear ?? undefined,
    yearsExperience: dealer.yearsExperience ?? undefined,
    teamSize: dealer.teamSize ?? undefined,
    dealTypes: dealer.dealTypes ?? [],
    languages: dealer.languages ?? [],
    priceRangeMin: dealer.priceRangeMin ?? undefined,
    priceRangeMax: dealer.priceRangeMax ?? undefined,
    reraNumber: dealer.reraNumber ?? undefined,
    gstNumber: dealer.gstNumber ?? undefined,
    officeAddress: dealer.officeAddress ?? undefined,
    mapLat: dealer.mapLat ?? undefined,
    mapLng: dealer.mapLng ?? undefined,
    workingHours: (dealer.workingHours ?? []).map((w) => ({
      day: w.day ?? "",
      open: w.open ?? undefined,
      close: w.close ?? undefined,
      closed: Boolean(w.closed),
    })),
    // Contact details are public ONLY when the dealer opted in (Section 13).
    publicEmail: dealer.publicEmailOptIn ? (dealer.publicEmail ?? undefined) : undefined,
    publicPhone: dealer.publicPhoneOptIn ? (dealer.phone ?? undefined) : undefined,
    verificationTier: dealer.verificationTier ?? 0,
    rating: dealer.rating ?? 0,
    ratingCount: dealer.ratingCount ?? 0,
    avgResponseMinutes: dealer.avgResponseMinutes ?? undefined,
    coverageCities,
    serviceLocalities,
    zenithConnected: Boolean(dealer.zenithConnected),
    zenithNumber: dealer.zenithConnected ? (dealer.zenithNumber ?? null) : null,
    listingCount: listings.length,
    listings,
    updatedAt: (dealer.updatedAt ?? new Date()).toISOString(),
  };
}

/**
 * A profile qualifies for search indexing (and the sitemap) only when the dealer
 * is verified (Tier 1+), has 3+ active listings, and has filled the about field.
 * Everything else stays noindex — thin profiles drag down domain quality (S10).
 */
export function agentQualifiesForIndex(a: {
  verificationTier: number;
  listingCount: number;
  about?: string;
}): boolean {
  return (
    a.verificationTier >= 1 &&
    a.listingCount >= 3 &&
    Boolean(a.about && a.about.trim().length > 0)
  );
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
