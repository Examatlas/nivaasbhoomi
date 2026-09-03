import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { ok, fail, withErrorHandling, LOCATION_CACHE_HEADERS } from "@/lib/api/response";

/**
 * GET /api/locations/cities?stateId=&active=true  (DEV-SPEC.txt Section 7)
 *   -> data: [{ _id, name, slug, tier }]
 *
 * Second level of the cascading dropdown. `stateId` scopes to one state (how the
 * dropdown calls it); `active=true` limits to launched cities. Sorted by tier
 * then name so metros surface first.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await connectDB();

  const params = req.nextUrl.searchParams;
  const stateId = params.get("stateId");
  const activeOnly = params.get("active") === "true";

  const filter: Record<string, unknown> = {};

  if (stateId) {
    if (!mongoose.Types.ObjectId.isValid(stateId)) {
      return fail("VALIDATION_ERROR", "stateId is not a valid id.");
    }
    filter.stateId = new mongoose.Types.ObjectId(stateId);
  }
  if (activeOnly) filter.isActive = true;

  const cities = await City.find(filter, { name: 1, slug: 1, tier: 1 })
    .sort({ tier: 1, name: 1 })
    .lean();

  const data = cities.map((c) => ({
    _id: String(c._id),
    name: c.name,
    slug: c.slug,
    tier: c.tier,
  }));

  return ok(data, { headers: LOCATION_CACHE_HEADERS });
});
