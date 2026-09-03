import type { NextRequest } from "next/server";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import { ok, withErrorHandling, LOCATION_CACHE_HEADERS } from "@/lib/api/response";

/**
 * GET /api/locations/states?active=true  (DEV-SPEC.txt Section 7)
 *   -> data: [{ _id, name, slug, code }]
 *
 * Top of the cascading dropdown. Public and heavily cached - states change
 * rarely. `active=true` limits to launched states (the buyer-facing dropdown);
 * omit it for the full list (admin / dealer coverage picker).
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await connectDB();

  const activeOnly = req.nextUrl.searchParams.get("active") === "true";
  const filter = activeOnly ? { isActive: true } : {};

  const states = await State.find(filter, { name: 1, slug: 1, code: 1 })
    .sort({ name: 1 })
    .lean();

  const data = states.map((s) => ({
    _id: String(s._id),
    name: s.name,
    slug: s.slug,
    code: s.code,
  }));

  return ok(data, { headers: LOCATION_CACHE_HEADERS });
});
