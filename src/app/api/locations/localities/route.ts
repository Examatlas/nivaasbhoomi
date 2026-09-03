import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling, LOCATION_CACHE_HEADERS } from "@/lib/api/response";

/**
 * GET /api/locations/localities?cityId=&active=true  (DEV-SPEC.txt Section 7)
 *   -> data: [{ _id, name, slug }]
 *
 * Third level of the cascading dropdown. `cityId` is effectively required - a
 * city has hundreds of localities and there are ~162k in total, so we never
 * return an unscoped list. Only 'approved' localities are returned (pending
 * requests are not real places yet); `active=true` narrows further to live ones.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await connectDB();

  const params = req.nextUrl.searchParams;
  const cityId = params.get("cityId");
  const activeOnly = params.get("active") === "true";

  if (!cityId) {
    return fail("VALIDATION_ERROR", "cityId is required.");
  }
  if (!mongoose.Types.ObjectId.isValid(cityId)) {
    return fail("VALIDATION_ERROR", "cityId is not a valid id.");
  }

  const filter: Record<string, unknown> = {
    cityId: new mongoose.Types.ObjectId(cityId),
    status: "approved",
  };
  if (activeOnly) filter.isActive = true;

  const localities = await Locality.find(filter, {
    name: 1,
    slug: 1,
    pincodes: 1,
    lat: 1,
    lng: 1,
  })
    .sort({ name: 1 })
    .lean();

  const data = localities.map((l) => ({
    _id: String(l._id),
    name: l.name,
    slug: l.slug,
    // Pincode disambiguates same-named localities in the dropdown
    // (India Post data has one locality name across several pincodes).
    pincode: l.pincodes?.[0] ?? null,
    pincodes: l.pincodes ?? [],
    lat: l.lat ?? null,
    lng: l.lng ?? null,
  }));

  return ok(data, { headers: LOCATION_CACHE_HEADERS });
});
