import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";

/** Cities that currently have live seed listings, with their counts (admin). */
export async function getSeedCityCounts(): Promise<{ cityId: string; cityName: string; count: number }[]> {
  await connectDB();
  const agg = await Listing.aggregate<{ _id: unknown; count: number }>([
    { $match: { isSeed: true, status: { $ne: "deleted" } } },
    { $group: { _id: "$cityId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const cities = await City.find({ _id: { $in: agg.map((a) => a._id).filter(Boolean) } }, { name: 1 }).lean();
  const name = new Map(cities.map((c) => [String(c._id), c.name]));
  return agg.map((a) => ({ cityId: String(a._id), cityName: name.get(String(a._id)) ?? "Unknown city", count: a.count }));
}

const SEED_ARCHIVE_DAYS_DEFAULT = 30;

/**
 * Archive seed listings whose seedExpiresAt has passed (the expire-seed cron).
 * "Archive" = status "deleted" so they leave every public query; real listings
 * (isSeed !== true) are never touched. Idempotent.
 */
export async function archiveExpiredSeedListings(
  now: Date = new Date(),
): Promise<{ archived: number }> {
  await connectDB();
  const res = await Listing.updateMany(
    { isSeed: true, status: "approved", seedExpiresAt: { $ne: null, $lte: now } },
    { $set: { status: "deleted" } },
  );
  return { archived: res.modifiedCount ?? 0 };
}

/** Bulk-delete (archive) ALL seed listings in a city — real listings untouched. */
export async function deleteSeedListingsInCity(cityId: string): Promise<{ deleted: number }> {
  if (!mongoose.Types.ObjectId.isValid(cityId)) return { deleted: 0 };
  await connectDB();
  const res = await Listing.updateMany(
    { isSeed: true, cityId: new mongoose.Types.ObjectId(cityId), status: { $ne: "deleted" } },
    { $set: { status: "deleted" } },
  );
  return { deleted: res.modifiedCount ?? 0 };
}

/** Mark / unmark a single listing as seed (+ default seedExpiresAt when marking). */
export async function setListingSeed(
  listingId: string,
  isSeed: boolean,
  seedExpiresAt?: Date | null,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(listingId)) return false;
  await connectDB();
  const set: Record<string, unknown> = { isSeed };
  if (isSeed) {
    set.seedExpiresAt =
      seedExpiresAt ?? new Date(Date.now() + SEED_ARCHIVE_DAYS_DEFAULT * 24 * 60 * 60 * 1000);
  } else {
    set.seedExpiresAt = null;
  }
  const res = await Listing.updateOne({ _id: listingId }, { $set: set });
  return (res.matchedCount ?? 0) > 0;
}
