import type { NextRequest } from "next/server";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import { City } from "@/lib/db/models/City";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { parseListQuery, paginated, escapeRegExp } from "@/lib/api/pagination";

/**
 * GET /api/admin/locations/states  [admin]
 * Searchable, paginated list of states for the admin location manager.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const query = parseListQuery(req, 50);

  const filter: Record<string, unknown> = {};
  if (query.q) filter.name = new RegExp(escapeRegExp(query.q), "i");

  const [items, total] = await Promise.all([
    State.find(filter, { name: 1, slug: 1, code: 1, isActive: 1 })
      .sort({ name: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    State.countDocuments(filter),
  ]);

  // Live city counts per state (active + total) — the coverage the admin needs.
  const stateIds = items.map((s) => s._id);
  const cityAgg = await City.aggregate<{ _id: unknown; total: number; active: number }>([
    { $match: { stateId: { $in: stateIds } } },
    {
      $group: {
        _id: "$stateId",
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
      },
    },
  ]);
  const cityCounts = new Map(cityAgg.map((a) => [String(a._id), a]));

  return ok(
    paginated(
      items.map((s) => {
        const c = cityCounts.get(String(s._id));
        return {
          _id: String(s._id),
          name: s.name,
          slug: s.slug,
          code: s.code,
          isActive: s.isActive,
          activeCityCount: c?.active ?? 0,
          cityCount: c?.total ?? 0,
        };
      }),
      total,
      query,
    ),
  );
});
