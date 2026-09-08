import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { Locality } from "@/lib/db/models/Locality";
import { CITY_ACTIVATION_THRESHOLDS } from "@/lib/locations/activation";
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
    City.find(filter, { name: 1, slug: 1, tier: 1, isActive: 1, stateId: 1 })
      .sort({ tier: 1, name: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    City.countDocuments(filter),
  ]);

  // LIVE counts for the page of cities — the cached city.* counters go stale
  // (e.g. seed import inserts listings without touching them), which is why a
  // city with real listings showed 0. Batched: one aggregate per collection.
  const cityIds = items.map((c) => c._id);
  const [listingAgg, dealerAgg, localityAgg] = await Promise.all([
    Listing.aggregate<{ _id: unknown; total: number; real: number }>([
      { $match: { cityId: { $in: cityIds }, status: "approved" } },
      {
        $group: {
          _id: "$cityId",
          total: { $sum: 1 }, // seed included — activation counts seed
          real: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 0, 1] } },
        },
      },
    ]),
    Dealer.aggregate<{ _id: unknown; n: number }>([
      {
        $match: {
          coverageCities: { $in: cityIds },
          verificationTier: { $gte: 1 },
          status: { $ne: "banned" },
        },
      },
      { $unwind: "$coverageCities" },
      { $match: { coverageCities: { $in: cityIds } } },
      { $group: { _id: "$coverageCities", n: { $sum: 1 } } },
    ]),
    Locality.aggregate<{ _id: unknown; n: number }>([
      { $match: { cityId: { $in: cityIds }, isActive: true } },
      { $group: { _id: "$cityId", n: { $sum: 1 } } },
    ]),
  ]);
  const listingCounts = new Map(listingAgg.map((a) => [String(a._id), a]));
  const dealerCounts = new Map(dealerAgg.map((a) => [String(a._id), a.n]));
  const localityCounts = new Map(localityAgg.map((a) => [String(a._id), a.n]));

  const t = CITY_ACTIVATION_THRESHOLDS;
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

  return ok(
    paginated(
      items.map((c) => {
        const id = String(c._id);
        const listings = listingCounts.get(id);
        const listingCount = listings?.total ?? 0; // seed included (activation basis)
        const realListingCount = listings?.real ?? 0;
        const dealerCount = dealerCounts.get(id) ?? 0;
        const localityCount = localityCounts.get(id) ?? 0;

        // Same guard the activate endpoint enforces (LIVE counts), surfaced so
        // the row can show an always-visible Activate button + a reason.
        const missing: string[] = [];
        if (listingCount < t.approvedListings)
          missing.push(`Needs ${plural(t.approvedListings, "listing")} (has ${listingCount})`);
        if (dealerCount < t.verifiedDealers)
          missing.push(`Needs ${plural(t.verifiedDealers, "verified dealer")} (has ${dealerCount})`);
        if (localityCount < t.activeLocalities)
          missing.push(`Needs ${plural(t.activeLocalities, "active locality")} (has ${localityCount})`);

        return {
          _id: id,
          name: c.name,
          slug: c.slug,
          tier: c.tier,
          isActive: c.isActive,
          stateId: String(c.stateId),
          listingCount,
          realListingCount,
          dealerCount,
          localityCount,
          canActivate: missing.length === 0,
          activationHint: missing[0] ?? null,
        };
      }),
      total,
      query,
    ),
  );
});
