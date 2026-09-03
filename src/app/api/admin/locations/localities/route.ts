import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
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
  const auth = requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);
  const params = req.nextUrl.searchParams;
  const cityId = params.get("cityId");
  const status = params.get("status"); // 'approved' | 'pending'
  const activeParam = params.get("active");

  const filter: Record<string, unknown> = {};
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), "i");
  if (cityId) {
    if (!mongoose.Types.ObjectId.isValid(cityId)) {
      return fail("VALIDATION_ERROR", "cityId is not a valid id.");
    }
    filter.cityId = new mongoose.Types.ObjectId(cityId);
  }
  if (status === "approved" || status === "pending") filter.status = status;
  if (activeParam === "true") filter.isActive = true;
  if (activeParam === "false") filter.isActive = false;

  const [items, total] = await Promise.all([
    Locality.find(filter, {
      name: 1,
      slug: 1,
      status: 1,
      isActive: 1,
      cityId: 1,
      listingCount: 1,
      pincodes: 1,
    })
      .sort({ name: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    Locality.countDocuments(filter),
  ]);

  return ok(
    paginated(
      items.map((l) => ({
        _id: String(l._id),
        name: l.name,
        slug: l.slug,
        status: l.status,
        isActive: l.isActive,
        cityId: String(l.cityId),
        listingCount: l.listingCount ?? 0,
        pincodes: l.pincodes ?? [],
      })),
      total,
      query,
    ),
  );
});
