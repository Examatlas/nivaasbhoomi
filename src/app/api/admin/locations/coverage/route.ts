import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * GET /api/admin/locations/coverage?includeInactive=  [admin]
 *
 * The "Live coverage" dashboard tree: State → City → Locality, with live
 * listing counts (real / seed) and dealer counts. Built from LIVE data, not the
 * cached counters. By default only ACTIVE cities (and the localities under them
 * that have listings) are returned — the single "what's live" view. With
 * includeInactive=true it also includes cities that have listings but aren't
 * active yet, so gaps (where inventory exists but the city isn't launched) show.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CoverageLocality {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  realListings: number;
  seedListings: number;
}
interface CoverageCity {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  realListings: number;
  seedListings: number;
  dealers: number;
  localities: CoverageLocality[];
}
interface CoverageState {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  cities: CoverageCity[];
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

  // Cities in scope: active only, or every city that has approved listings.
  const cityFilter = includeInactive
    ? { _id: { $in: await Listing.distinct("cityId", { status: "approved" }) } }
    : { isActive: true };
  const cities = await City.find(cityFilter, {
    name: 1,
    slug: 1,
    isActive: 1,
    stateId: 1,
  }).lean();
  const cityIds = cities.map((c) => c._id);

  const [cityAgg, localityAgg, dealerAgg] = await Promise.all([
    Listing.aggregate<{ _id: unknown; real: number; seed: number }>([
      { $match: { cityId: { $in: cityIds }, status: "approved" } },
      {
        $group: {
          _id: "$cityId",
          real: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 0, 1] } },
          seed: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 1, 0] } },
        },
      },
    ]),
    Listing.aggregate<{ _id: unknown; cityId: unknown; real: number; seed: number }>([
      { $match: { cityId: { $in: cityIds }, status: "approved" } },
      {
        $group: {
          _id: "$localityId",
          cityId: { $first: "$cityId" },
          real: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 0, 1] } },
          seed: { $sum: { $cond: [{ $eq: ["$isSeed", true] }, 1, 0] } },
        },
      },
    ]),
    Dealer.aggregate<{ _id: unknown; n: number }>([
      { $match: { coverageCities: { $in: cityIds }, status: { $ne: "banned" } } },
      { $unwind: "$coverageCities" },
      { $match: { coverageCities: { $in: cityIds } } },
      { $group: { _id: "$coverageCities", n: { $sum: 1 } } },
    ]),
  ]);
  const cityCounts = new Map(cityAgg.map((a) => [String(a._id), a]));
  const dealerCounts = new Map(dealerAgg.map((a) => [String(a._id), a.n]));

  // Resolve locality names/isActive for the localities that have listings.
  const localityIds = localityAgg.map((a) => a._id as mongoose.Types.ObjectId);
  const locDocs = await Locality.find(
    { _id: { $in: localityIds } },
    { name: 1, slug: 1, isActive: 1, cityId: 1 },
  ).lean();
  const locName = new Map(locDocs.map((l) => [String(l._id), l]));
  const localitiesByCity = new Map<string, CoverageLocality[]>();
  for (const a of localityAgg) {
    const doc = locName.get(String(a._id));
    if (!doc) continue;
    const arr = localitiesByCity.get(String(a.cityId)) ?? [];
    arr.push({
      _id: String(a._id),
      name: doc.name,
      slug: doc.slug,
      isActive: Boolean(doc.isActive),
      realListings: a.real,
      seedListings: a.seed,
    });
    localitiesByCity.set(String(a.cityId), arr);
  }
  for (const arr of localitiesByCity.values()) {
    arr.sort((x, y) => y.realListings + y.seedListings - (x.realListings + x.seedListings));
  }

  // States for the cities in scope.
  const stateIds = [...new Set(cities.map((c) => String(c.stateId)))];
  const stateDocs = await State.find(
    { _id: { $in: stateIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { name: 1, slug: 1, isActive: 1 },
  ).lean();
  const stateMap = new Map(stateDocs.map((s) => [String(s._id), s]));

  // Assemble the tree.
  const byState = new Map<string, CoverageState>();
  for (const c of cities) {
    const sid = String(c.stateId);
    const sdoc = stateMap.get(sid);
    if (!sdoc) continue;
    if (!byState.has(sid)) {
      byState.set(sid, {
        _id: sid,
        name: sdoc.name,
        slug: sdoc.slug,
        isActive: Boolean(sdoc.isActive),
        cities: [],
      });
    }
    const cc = cityCounts.get(String(c._id));
    byState.get(sid)!.cities.push({
      _id: String(c._id),
      name: c.name,
      slug: c.slug,
      isActive: Boolean(c.isActive),
      realListings: cc?.real ?? 0,
      seedListings: cc?.seed ?? 0,
      dealers: dealerCounts.get(String(c._id)) ?? 0,
      localities: localitiesByCity.get(String(c._id)) ?? [],
    });
  }
  const states = [...byState.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const s of states) s.cities.sort((a, b) => a.name.localeCompare(b.name));

  // Summary counts the LIVE (active) things regardless of the includeInactive view.
  const activeStates = states.filter((s) => s.isActive).length;
  const activeCities = states.reduce(
    (n, s) => n + s.cities.filter((c) => c.isActive).length,
    0,
  );
  const activeLocalities = states.reduce(
    (n, s) =>
      n + s.cities.reduce((m, c) => m + c.localities.filter((l) => l.isActive).length, 0),
    0,
  );
  const localitiesWithInventory = states.reduce(
    (n, s) => n + s.cities.reduce((m, c) => m + c.localities.length, 0),
    0,
  );

  return ok({
    summary: {
      states: activeStates,
      cities: activeCities,
      localities: activeLocalities,
      localitiesWithInventory,
    },
    states,
  });
});
