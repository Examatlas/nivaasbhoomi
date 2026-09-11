import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling, LOCATION_CACHE_HEADERS } from "@/lib/api/response";

/**
 * GET /api/locations/localities?cityId=&q=&active=true   (DEV-SPEC.txt Section 7)
 *   -> data: [{ _id, name, slug, pincode, pincodes[], lat, lng }]
 *
 * Third level of the location picker. `cityId` is REQUIRED — a city has hundreds
 * of localities and there are ~162k in total, so the query is always
 * city-scoped. Only 'approved' localities are returned; `active=true` narrows to
 * live ones.
 *
 * SEARCH (`q`, min 2 chars): case-insensitive partial match on the locality NAME
 * plus prefix match on PINCODE (when q is numeric). Results are ranked — exact
 * name-prefix first, then name-contains, then pincode — and capped by `limit`
 * (default 20, max 25). Without `q` the full city list is returned (the legacy
 * cascading behaviour), sorted by name.
 */
export const runtime = "nodejs";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  await connectDB();

  const params = req.nextUrl.searchParams;
  const cityId = params.get("cityId");
  const activeOnly = params.get("active") === "true";
  const q = (params.get("q") ?? "").trim();
  const limitParam = params.get("limit");
  const limitNum = limitParam != null ? Number(limitParam) : NaN;
  const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), 25) : 20;

  if (!cityId) return fail("VALIDATION_ERROR", "cityId is required.");
  if (!mongoose.Types.ObjectId.isValid(cityId)) {
    return fail("VALIDATION_ERROR", "cityId is not a valid id.");
  }

  const filter: Record<string, unknown> = {
    cityId: new mongoose.Types.ObjectId(cityId),
    status: "approved",
  };
  if (activeOnly) filter.isActive = true;

  const projection = { name: 1, slug: 1, pincodes: 1, lat: 1, lng: 1 } as const;
  const byId = params.get("id");
  const shape = (l: {
    _id: unknown;
    name: string;
    slug: string;
    pincodes?: string[];
    lat?: number | null;
    lng?: number | null;
  }) => ({
    _id: String(l._id),
    name: l.name,
    slug: l.slug,
    // Pincode disambiguates same-named localities (India Post data reuses names).
    pincode: l.pincodes?.[0] ?? null,
    pincodes: l.pincodes ?? [],
    lat: l.lat ?? null,
    lng: l.lng ?? null,
  });

  // ── By-id resolve (picker rehydrates a preset locality's label in edit mode) ─
  if (byId) {
    if (!mongoose.Types.ObjectId.isValid(byId)) return ok([]);
    const one = await Locality.findOne(
      { ...filter, _id: new mongoose.Types.ObjectId(byId) },
      projection,
    ).lean();
    return ok(one ? [shape(one)] : []);
  }

  // A present-but-too-short query returns nothing (never the full city list) —
  // the picker enforces a 2-char minimum, and a stray 1-char q must not leak all.
  if (q.length === 1) return ok([]);

  // ── Search mode ─────────────────────────────────────────────────────────────
  if (q.length >= 2) {
    const numeric = /^\d+$/.test(q);
    const nameRx = new RegExp(escapeRegex(q), "i"); // partial, case-insensitive
    filter.$or = [
      { name: nameRx },
      ...(numeric ? [{ pincodes: new RegExp("^" + escapeRegex(q)) }] : []),
    ];

    // Fetch a bounded candidate set within the city, then rank in memory.
    const rows = await Locality.find(filter, projection).limit(100).lean();
    const qLower = q.toLowerCase();
    const rank = (name: string, pincodes: string[]) => {
      const n = name.toLowerCase();
      if (n.startsWith(qLower)) return 0; // exact name prefix
      if (n.includes(qLower)) return 1; // name contains
      if (numeric && pincodes.some((p) => p.startsWith(q))) return 2; // pincode
      return 3;
    };
    const ranked = rows
      .map((l) => ({ l, r: rank(l.name, l.pincodes ?? []) }))
      .sort((a, b) => a.r - b.r || a.l.name.localeCompare(b.l.name))
      .slice(0, limit)
      .map((x) => shape(x.l));

    // Search results are user-specific/volatile — do not CDN-cache them.
    return ok(ranked);
  }

  // ── Legacy full-list mode (no q) ─────────────────────────────────────────────
  const localities = await Locality.find(filter, projection).sort({ name: 1 }).lean();
  return ok(localities.map(shape), { headers: LOCATION_CACHE_HEADERS });
});
