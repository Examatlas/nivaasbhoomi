import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { LocalityRate } from "@/lib/db/models/LocalityRate";
import { CityRate } from "@/lib/db/models/CityRate";
import {
  computeGroupRate,
  toRatePropertyType,
  toRatePurpose,
  pickArea,
  type RateListing,
  type RatePropertyType,
  type RatePurpose,
} from "@/lib/rates/aggregate";

export interface RateComputeSummary {
  computedAt: string;
  listingsScanned: number;
  localityGroups: number;
  cityGroups: number;
  localityUpserts: number;
  cityUpserts: number;
}

interface Group {
  localityId?: string;
  cityId: string;
  stateId: string | null;
  propertyType: RatePropertyType;
  purpose: RatePurpose;
  items: RateListing[];
}

/**
 * Recompute every LocalityRate + CityRate from approved listings. Pure math is
 * delegated to computeGroupRate, so this only groups + upserts. Idempotent: the
 * same listing set produces the same aggregates (keyed uniquely per group).
 */
export async function computeLocalityRates(now: Date = new Date()): Promise<RateComputeSummary> {
  await connectDB();

  const listings = await Listing.find(
    { status: "approved" },
    {
      cityId: 1, localityId: 1, stateId: 1, propertyType: 1, purpose: 1,
      expectedPrice: 1, monthlyRent: 1, carpetArea: 1, builtUpArea: 1, plotArea: 1, createdAt: 1,
    },
  ).lean();

  const locGroups = new Map<string, Group>();
  const cityGroups = new Map<string, Group>();

  for (const l of listings) {
    const rpt = toRatePropertyType(String(l.propertyType ?? ""));
    if (!rpt) continue;
    const rp = toRatePurpose(String(l.purpose ?? ""));
    const price = rp === "rent" ? l.monthlyRent : l.expectedPrice;
    if (!(typeof price === "number" && price > 0)) continue;
    if (!l.cityId) continue;

    const item: RateListing = {
      price,
      area: pickArea(l),
      createdAt: l.createdAt ? new Date(l.createdAt) : null,
    };
    const cityId = String(l.cityId);
    const stateId = l.stateId ? String(l.stateId) : null;

    if (l.localityId) {
      const localityId = String(l.localityId);
      const key = `${localityId}|${rpt}|${rp}`;
      const g = locGroups.get(key) ?? { localityId, cityId, stateId, propertyType: rpt, purpose: rp, items: [] };
      g.items.push(item);
      locGroups.set(key, g);
    }

    const ckey = `${cityId}|${rpt}|${rp}`;
    const cg = cityGroups.get(ckey) ?? { cityId, stateId, propertyType: rpt, purpose: rp, items: [] };
    cg.items.push(item);
    cityGroups.set(ckey, cg);
  }

  let localityUpserts = 0;
  for (const g of locGroups.values()) {
    const r = computeGroupRate(g.items, now);
    await LocalityRate.updateOne(
      { localityId: g.localityId, propertyType: g.propertyType, purpose: g.purpose },
      {
        $set: {
          cityId: new mongoose.Types.ObjectId(g.cityId),
          stateId: g.stateId ? new mongoose.Types.ObjectId(g.stateId) : null,
          ...r,
          computedAt: now,
        },
      },
      { upsert: true },
    );
    localityUpserts += 1;
  }

  let cityUpserts = 0;
  for (const g of cityGroups.values()) {
    const r = computeGroupRate(g.items, now);
    await CityRate.updateOne(
      { cityId: new mongoose.Types.ObjectId(g.cityId), propertyType: g.propertyType, purpose: g.purpose },
      {
        $set: {
          stateId: g.stateId ? new mongoose.Types.ObjectId(g.stateId) : null,
          ...r,
          computedAt: now,
        },
      },
      { upsert: true },
    );
    cityUpserts += 1;
  }

  return {
    computedAt: now.toISOString(),
    listingsScanned: listings.length,
    localityGroups: locGroups.size,
    cityGroups: cityGroups.size,
    localityUpserts,
    cityUpserts,
  };
}
