import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";
import { listingInputSchema } from "@/lib/listings/schema";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";

/**
 * GET  /api/admin/listings   [admin] - searchable, paginated, filterable browser
 *   query: q, status, cityId, dealerId, page, limit
 * POST /api/admin/listings   [admin] - manual listing entry (Section 15)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);
  const p = req.nextUrl.searchParams;
  const status = p.get("status");
  const cityId = p.get("cityId");
  const dealerId = p.get("dealerId");

  const filter: Record<string, unknown> = {};
  if (query.q) filter.title = new RegExp(escapeRegExp(query.q), "i");
  if (
    status &&
    [
      "draft",
      "pending",
      "pending-location",
      "approved",
      "rejected",
      "expired",
      "deleted",
    ].includes(status)
  ) {
    filter.status = status;
  } else {
    filter.status = { $ne: "deleted" }; // hide soft-deleted by default
  }
  if (cityId && mongoose.Types.ObjectId.isValid(cityId)) {
    filter.cityId = new mongoose.Types.ObjectId(cityId);
  }
  if (dealerId && mongoose.Types.ObjectId.isValid(dealerId)) {
    filter.dealerId = new mongoose.Types.ObjectId(dealerId);
  }
  // Seed (display-only) filter: "seed" → only seed, "real" → exclude seed.
  const seed = p.get("seed");
  if (seed === "seed") filter.isSeed = true;
  else if (seed === "real") filter.isSeed = { $ne: true };

  type Row = {
    _id: mongoose.Types.ObjectId;
    title: string;
    slug?: string;
    status: string;
    purpose: string;
    propertyType: string;
    bhk?: string;
    expectedPrice?: number;
    monthlyRent?: number;
    cityId: mongoose.Types.ObjectId;
    localityId: mongoose.Types.ObjectId;
    dealerId: mongoose.Types.ObjectId;
    photos?: { url: string; width?: number; height?: number; isLowResolution?: boolean }[];
    coverPhotoIndex?: number;
    createdAt?: Date;
    expiresAt?: Date;
    isSeed?: boolean;
  };

  const [items, total] = await Promise.all([
    Listing.find(filter, {
      title: 1,
      slug: 1,
      status: 1,
      purpose: 1,
      propertyType: 1,
      bhk: 1,
      expectedPrice: 1,
      monthlyRent: 1,
      cityId: 1,
      localityId: 1,
      dealerId: 1,
      photos: 1,
      coverPhotoIndex: 1,
      createdAt: 1,
      expiresAt: 1,
      isSeed: 1,
    })
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean<Row[]>(),
    Listing.countDocuments(filter),
  ]);

  // Resolve city + dealer names in bulk. Guard against listings with a
  // missing/invalid cityId or dealerId: String(undefined) === "undefined",
  // which CastErrors when cast to ObjectId inside the $in lookup.
  const cityIds = [
    ...new Set(items.map((l) => l.cityId).filter((v) => mongoose.isValidObjectId(v)).map(String)),
  ];
  const dealerIds = [
    ...new Set(items.map((l) => l.dealerId).filter((v) => mongoose.isValidObjectId(v)).map(String)),
  ];
  const [cities, dealers] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Dealer.find({ _id: { $in: dealerIds } }, { businessName: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const dealerName = new Map(dealers.map((d) => [String(d._id), d.businessName]));

  return ok(
    paginated(
      items.map((l) => {
        const cover = l.photos?.[l.coverPhotoIndex ?? 0] ?? l.photos?.[0];
        // Smallest photo's shorter side (a fast quality signal for reviewers),
        // and whether any photo is tagged low-resolution.
        const dims = (l.photos ?? [])
          .map((p) => Math.min(p.width ?? 0, p.height ?? 0))
          .filter((n) => n > 0);
        const minResolution = dims.length ? Math.min(...dims) : null;
        const hasLowRes =
          (l.photos ?? []).some((p) => p.isLowResolution) ||
          (minResolution != null && minResolution < 800);
        return {
          _id: String(l._id),
          title: l.title,
          slug: l.slug ?? null,
          status: l.status,
          purpose: l.purpose,
          propertyType: l.propertyType,
          bhk: l.bhk ?? null,
          price: l.purpose === "rent" ? (l.monthlyRent ?? 0) : (l.expectedPrice ?? 0),
          cityName: cityName.get(String(l.cityId)) ?? "—",
          dealerName: dealerName.get(String(l.dealerId)) ?? "—",
          coverUrl: cover?.url ?? null,
          photoCount: l.photos?.length ?? 0,
          minResolution,
          hasLowRes,
          createdAt: l.createdAt,
          expiresAt: l.expiresAt,
          isSeed: Boolean(l.isSeed),
        };
      }),
      total,
      query,
    ),
  );
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = listingInputSchema.safeParse(json);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Please fix the listing details.",
      parsed.error.flatten(),
    );
  }
  const data = parsed.data;

  await connectDB();

  // Referential checks.
  const [dealer, locality] = await Promise.all([
    Dealer.findById(data.dealerId, { _id: 1 }).lean(),
    Locality.findById(data.localityId, { cityId: 1, stateId: 1 }).lean(),
  ]);
  if (!dealer) return fail("VALIDATION_ERROR", "Selected dealer does not exist.");
  if (!locality) return fail("VALIDATION_ERROR", "Selected locality does not exist.");
  if (String(locality.cityId) !== data.cityId) {
    return fail("VALIDATION_ERROR", "Locality does not belong to the selected city.");
  }

  try {
    const listing = await Listing.create(data);

    // If filed directly as approved, refresh the affected counters/activation.
    if (listing.status === "approved") {
      await Promise.all([
        recalculateCounters(listing.cityId!),
        recalculateLocalityActivation(listing.localityId!),
      ]);
    }

    return ok({ _id: String(listing._id), slug: listing.slug, status: listing.status });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      const fields = Object.fromEntries(
        Object.entries(err.errors).map(([k, e]) => [k, [e.message]]),
      );
      return fail("VALIDATION_ERROR", "Listing failed validation.", {
        fieldErrors: fields,
      });
    }
    throw err;
  }
});
