import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";

/**
 * GET /api/admin/locations/localities?cityId=&status=&q=&page=&limit=  [admin]
 *
 * Server-side searchable, paginated locality browser. There are ~162k
 * localities, so this NEVER returns an unbounded list - `limit` is capped and a
 * `cityId` scope is strongly encouraged.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);
  const params = req.nextUrl.searchParams;
  const cityId = params.get("cityId");
  const status = params.get("status"); // 'approved' | 'pending'
  const activeParam = params.get("active");
  const hasListings = params.get("hasListings") === "true"; // only localities with approved listings

  const filter: Record<string, unknown> = {};
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), "i");
  const cityObjId = cityId ? new mongoose.Types.ObjectId(cityId) : null;
  if (cityId) {
    if (!mongoose.Types.ObjectId.isValid(cityId)) {
      return fail("VALIDATION_ERROR", "cityId is not a valid id.");
    }
    filter.cityId = cityObjId;
  }
  if (status === "approved" || status === "pending") filter.status = status;
  if (activeParam === "true") filter.isActive = true;
  if (activeParam === "false") filter.isActive = false;

  // "Only localities with listings" — restrict to localityIds that have an
  // approved listing (scoped to the city when given, so it stays bounded).
  if (hasListings) {
    const withListings = await Listing.distinct("localityId", {
      status: "approved",
      ...(cityObjId ? { cityId: cityObjId } : {}),
    });
    filter._id = { $in: withListings };
  }

  const [items, total] = await Promise.all([
    Locality.find(filter, {
      name: 1,
      slug: 1,
      status: 1,
      isActive: 1,
      cityId: 1,
      pincodes: 1,
    })
      .sort({ name: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    Locality.countDocuments(filter),
  ]);

  // LIVE listing counts (total seed-included + real) for the page of localities,
  // plus their city names. Cached locality.listingCount goes stale, so compute.
  const localityIds = items.map((l) => l._id);
  const cityIds = [...new Set(items.map((l) => String(l.cityId)))];
  const [listingAgg, cities] = await Promise.all([
    Listing.aggregate<{ _id: unknown; total: number; real: number }>([
      { $match: { localityId: { $in: localityIds }, status: "approved" } },
      {
        $group: {
          _id: "$localityId",
          total: { $sum: 1 },
          real: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 0, 1] } },
        },
      },
    ]),
    City.find(
      { _id: { $in: cityIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { name: 1, slug: 1 },
    ).lean(),
  ]);
  const counts = new Map(listingAgg.map((a) => [String(a._id), a]));
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));

  return ok(
    paginated(
      items.map((l) => {
        const c = counts.get(String(l._id));
        return {
          _id: String(l._id),
          name: l.name,
          slug: l.slug,
          status: l.status,
          isActive: l.isActive,
          cityId: String(l.cityId),
          cityName: cityName.get(String(l.cityId)) ?? "",
          listingCount: c?.total ?? 0,
          realListingCount: c?.real ?? 0,
          pincodes: l.pincodes ?? [],
        };
      }),
      total,
      query,
    ),
  );
});
