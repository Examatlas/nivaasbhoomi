import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { Locality } from "@/lib/db/models/Locality";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * Recompute the cached city.* counters (listingCount, localityCount,
 * dealerCount) from LIVE data. These counters go stale whenever listings are
 * written outside the normal approve path — notably the seed importer, which
 * inserts straight through the driver. `listingCount` counts APPROVED listings
 * seed-included (the activation basis).
 *
 * Pass `cityIds` to limit the work (e.g. only the cities a seed import touched),
 * or omit to recount every city. Returns the number of cities updated.
 */
export async function recountCities(
  cityIds?: (string | mongoose.Types.ObjectId)[],
): Promise<number> {
  await connectDB();

  const filter = cityIds
    ? { _id: { $in: cityIds.map((id) => new mongoose.Types.ObjectId(String(id))) } }
    : {};
  const cities = await City.find(filter, { _id: 1 }).lean();
  if (cities.length === 0) return 0;
  const cids = cities.map((c) => c._id);

  const [listingAgg, localityAgg, dealerAgg] = await Promise.all([
    Listing.aggregate<{ _id: unknown; n: number }>([
      { $match: { cityId: { $in: cids }, status: "approved" } },
      { $group: { _id: "$cityId", n: { $sum: 1 } } },
    ]),
    Locality.aggregate<{ _id: unknown; n: number }>([
      { $match: { cityId: { $in: cids }, isActive: true } },
      { $group: { _id: "$cityId", n: { $sum: 1 } } },
    ]),
    Dealer.aggregate<{ _id: unknown; n: number }>([
      { $match: { coverageCities: { $in: cids }, status: { $ne: "banned" } } },
      { $unwind: "$coverageCities" },
      { $match: { coverageCities: { $in: cids } } },
      { $group: { _id: "$coverageCities", n: { $sum: 1 } } },
    ]),
  ]);
  const lc = new Map(listingAgg.map((a) => [String(a._id), a.n]));
  const loc = new Map(localityAgg.map((a) => [String(a._id), a.n]));
  const dc = new Map(dealerAgg.map((a) => [String(a._id), a.n]));

  const ops = cities.map((c) => ({
    updateOne: {
      filter: { _id: c._id },
      update: {
        $set: {
          listingCount: lc.get(String(c._id)) ?? 0,
          localityCount: loc.get(String(c._id)) ?? 0,
          dealerCount: dc.get(String(c._id)) ?? 0,
        },
      },
    },
  }));
  if (ops.length) await City.bulkWrite(ops);
  return ops.length;
}
