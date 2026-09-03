import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";

/**
 * GET /api/admin/locations/cities?stateId=&q=&page=&limit=  [admin]
 * Searchable, paginated city browser. Server-side only - never loads all cities.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);
  const stateId = req.nextUrl.searchParams.get("stateId");
  const activeParam = req.nextUrl.searchParams.get("active");

  const filter: Record<string, unknown> = {};
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), "i");
  if (stateId) {
    if (!mongoose.Types.ObjectId.isValid(stateId)) {
      return fail("VALIDATION_ERROR", "stateId is not a valid id.");
    }
    filter.stateId = new mongoose.Types.ObjectId(stateId);
  }
  if (activeParam === "true") filter.isActive = true;
  if (activeParam === "false") filter.isActive = false;

  const [items, total] = await Promise.all([
    City.find(filter, {
      name: 1,
      slug: 1,
      tier: 1,
      isActive: 1,
      listingCount: 1,
      dealerCount: 1,
      localityCount: 1,
      stateId: 1,
    })
      .sort({ tier: 1, name: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    City.countDocuments(filter),
  ]);

  return ok(
    paginated(
      items.map((c) => ({
        _id: String(c._id),
        name: c.name,
        slug: c.slug,
        tier: c.tier,
        isActive: c.isActive,
        stateId: String(c.stateId),
        listingCount: c.listingCount ?? 0,
        dealerCount: c.dealerCount ?? 0,
        localityCount: c.localityCount ?? 0,
      })),
      total,
      query,
    ),
  );
});
