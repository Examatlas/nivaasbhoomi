import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { getDealerSession } from "@/lib/auth/middleware";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { photoUrl } from "@/lib/media/transforms";

/**
 * Dealer-owned listing reads (DEV-SPEC.txt Section 13 ownership).
 *
 * Every function is scoped to the SIGNED-IN dealer. A dealer can never read
 * another dealer's listing here - the queries always filter by the session
 * dealerId, which comes only from the verified JWT.
 */

export type MyListingStatus =
  | "draft"
  | "pending"
  | "pending-location"
  | "approved"
  | "rejected"
  | "expired"
  | "deleted";

export interface MyListingRow {
  id: string;
  title: string;
  slug?: string;
  status: MyListingStatus;
  purpose: "sale" | "rent";
  propertyType: string;
  price: number;
  localityName: string;
  cityName: string;
  thumb?: string;
  createdAt: string;
  expiresAt?: string;
  /** Whole days until expiry (negative if past); undefined when not applicable. */
  daysToExpiry?: number;
  rejectionReason?: string;
}

const DAY = 24 * 60 * 60 * 1000;

export async function getMyListings(): Promise<MyListingRow[] | null> {
  const session = await getDealerSession();
  if (!session) return null;

  await connectDB();
  const rows = await Listing.find({
    dealerId: new mongoose.Types.ObjectId(session.dealerId),
    status: { $ne: "deleted" },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (rows.length === 0) return [];

  // Drafts may have no city/locality yet - filter the raw ids BEFORE stringifying
  // (String(undefined) === "undefined", which would slip past a truthy filter).
  const cityIds = [...new Set(rows.map((r) => r.cityId).filter(Boolean).map(String))];
  const localityIds = [
    ...new Set(rows.map((r) => r.localityId).filter(Boolean).map(String)),
  ];
  const [cities, localities] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));

  const now = Date.now();
  return rows.map((l) => {
    const cover = (l.photos ?? [])[l.coverPhotoIndex ?? 0] ?? (l.photos ?? [])[0];
    const expiresAt = l.expiresAt ? new Date(l.expiresAt) : undefined;
    return {
      id: String(l._id),
      title: l.title || "(untitled draft)",
      slug: l.slug ?? undefined,
      status: l.status as MyListingStatus,
      purpose: (l.purpose as "sale" | "rent") ?? "sale",
      propertyType: l.propertyType ?? "",
      price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? 0,
      localityName: l.localityId ? (localityName.get(String(l.localityId)) ?? "") : "",
      cityName: l.cityId ? (cityName.get(String(l.cityId)) ?? "") : "",
      thumb: cover?.url
        ? photoUrl({ url: cover.url, publicId: cover.publicId ?? undefined }, "cardThumb")
        : undefined,
      createdAt: (l.createdAt ?? new Date()).toISOString(),
      expiresAt: expiresAt?.toISOString(),
      daysToExpiry:
        expiresAt && l.status === "approved"
          ? Math.ceil((expiresAt.getTime() - now) / DAY)
          : undefined,
      rejectionReason: l.rejectionReason ?? undefined,
    };
  });
}

/**
 * Full listing for the edit form, but ONLY if it belongs to the signed-in
 * dealer. Returns null when missing OR owned by someone else (no ownership leak).
 */
export async function getMyListingForEdit(
  id: string,
): Promise<Record<string, unknown> | null> {
  const session = await getDealerSession();
  if (!session) return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  await connectDB();
  const l = await Listing.findOne({
    _id: id,
    dealerId: new mongoose.Types.ObjectId(session.dealerId),
    status: { $ne: "deleted" },
  }).lean();
  if (!l) return null;

  // Shape into the flat form the wizard consumes (dates -> ISO strings).
  return {
    id: String(l._id),
    status: l.status,
    purpose: l.purpose,
    propertyType: l.propertyType,
    title: l.title,
    description: l.description,
    stateId: l.stateId ? String(l.stateId) : "",
    cityId: l.cityId ? String(l.cityId) : "",
    localityId: l.localityId ? String(l.localityId) : "",
    subLocality: l.subLocality,
    projectName: l.projectName,
    landmark: l.landmark,
    fullAddress: l.fullAddress,
    lat: l.lat,
    lng: l.lng,
    pincode: l.pincode,
    bhk: l.bhk,
    bathrooms: l.bathrooms,
    balconies: l.balconies,
    carpetArea: l.carpetArea,
    builtUpArea: l.builtUpArea,
    plotArea: l.plotArea,
    floor: l.floor,
    totalFloors: l.totalFloors,
    facing: l.facing,
    ageOfProperty: l.ageOfProperty,
    furnishing: l.furnishing,
    furnishingDetails: l.furnishingDetails ?? [],
    amenities: l.amenities ?? [],
    parking: l.parking,
    waterSource: l.waterSource ?? [],
    expectedPrice: l.expectedPrice,
    priceNegotiable: l.priceNegotiable,
    bookingAmount: l.bookingAmount,
    monthlyRent: l.monthlyRent,
    securityDeposit: l.securityDeposit,
    rentNegotiable: l.rentNegotiable,
    preferredTenant: l.preferredTenant ?? [],
    availableFrom: l.availableFrom ? new Date(l.availableFrom).toISOString() : undefined,
    minLeasePeriod: l.minLeasePeriod,
    maintenanceCharge: l.maintenanceCharge,
    brokerage: l.brokerage,
    possessionStatus: l.possessionStatus,
    possessionDate: l.possessionDate ? new Date(l.possessionDate).toISOString() : undefined,
    ownershipType: l.ownershipType,
    reraNumber: l.reraNumber,
    reraStateId: l.reraStateId ? String(l.reraStateId) : "",
    photos: (l.photos ?? []).map((p) => ({
      url: p.url,
      publicId: p.publicId ?? "",
      width: p.width ?? 1200,
      height: p.height ?? 900,
    })),
    coverPhotoIndex: l.coverPhotoIndex ?? 0,
  };
}
