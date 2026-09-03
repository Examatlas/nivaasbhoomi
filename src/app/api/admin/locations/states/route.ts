import type { NextRequest } from "next/server";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
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

  return ok(
    paginated(
      items.map((s) => ({
        _id: String(s._id),
        name: s.name,
        slug: s.slug,
        code: s.code,
        isActive: s.isActive,
      })),
      total,
      query,
    ),
  );
});
