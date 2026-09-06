import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { City } from "@/lib/db/models/City";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";

/**
 * GET /api/admin/locations/locality-requests?q=&page=&limit=  [admin]
 *
 * The pending-locality queue (Section 15) - dealer-requested localities awaiting
 * approval. Newest first. Each row carries its city name so the admin has
 * context without an extra lookup.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 25);

  const filter: Record<string, unknown> = { status: "pending" };
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), "i");

  type RequestRow = {
    _id: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    cityId: mongoose.Types.ObjectId;
    pincodes?: string[];
    requestedBy?: mongoose.Types.ObjectId | null;
    createdAt?: Date;
  };

  const [items, total] = await Promise.all([
    Locality.find(filter, {
      name: 1,
      slug: 1,
      cityId: 1,
      pincodes: 1,
      requestedBy: 1,
      createdAt: 1,
    })
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean<RequestRow[]>(),
    Locality.countDocuments(filter),
  ]);

  // Resolve city names in one query. Guard against requests with a
  // missing/invalid cityId (String(undefined) === "undefined" → CastError).
  const cityIds = [
    ...new Set(items.map((l) => l.cityId).filter((v) => mongoose.isValidObjectId(v)).map(String)),
  ];
  const cities = await City.find({ _id: { $in: cityIds } }, { name: 1, slug: 1 }).lean();
  const cityById = new Map(cities.map((c) => [String(c._id), c]));

  return ok(
    paginated(
      items.map((l) => {
        const city = cityById.get(String(l.cityId));
        return {
          _id: String(l._id),
          name: l.name,
          slug: l.slug,
          pincodes: l.pincodes ?? [],
          requestedBy: l.requestedBy ? String(l.requestedBy) : null,
          createdAt: l.createdAt,
          city: city ? { _id: String(city._id), name: city.name, slug: city.slug } : null,
        };
      }),
      total,
      query,
    ),
  );
});
