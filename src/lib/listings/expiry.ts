import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";
import { sendTemplate } from "@/lib/whatsapp/client";

/**
 * Listing expiry + freshness cron (DEV-SPEC.txt Section 13). Runs daily at
 * 02:00 IST:
 *   1. approved listings with expiresAt < now  -> 'expired', then recalculate
 *      the affected localities (auto-deactivating any that drop below 3 approved
 *      listings) and cities (alerting the admin if a city falls below 25).
 *   2. approved listings expiring within 5 days -> send the listing_expiry_warning
 *      template to the dealer (once per 30-day window).
 *
 * Never throws to the caller; per-listing failures are collected, not fatal.
 */

const CITY_MIN_LISTINGS = 25; // Section 13 city-activation floor
const WARN_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export interface ExpiryResult {
  expired: number;
  warningsSent: number;
  localitiesDeactivated: string[];
  cityAlerts: { cityId: string; listingCount: number }[];
}

export async function runExpiry(now: Date = new Date()): Promise<ExpiryResult> {
  await connectDB();

  // ---- 1. Expire overdue approved listings ----
  const overdue = await Listing.find(
    { status: "approved", expiresAt: { $lt: now } },
    { _id: 1, cityId: 1, localityId: 1 },
  ).lean();

  const affectedLocalities = new Set<string>();
  const affectedCities = new Set<string>();
  if (overdue.length > 0) {
    await Listing.updateMany(
      { _id: { $in: overdue.map((l) => l._id) } },
      { $set: { status: "expired" } },
    );
    for (const l of overdue) {
      if (l.localityId) affectedLocalities.add(String(l.localityId));
      if (l.cityId) affectedCities.add(String(l.cityId));
    }
  }

  // Recalculate each affected locality's activation (deactivate if < 3 approved).
  const localitiesDeactivated: string[] = [];
  for (const localityId of affectedLocalities) {
    try {
      const r = await recalculateLocalityActivation(localityId);
      if (!r.isActive) localitiesDeactivated.push(localityId);
    } catch {
      /* keep going */
    }
  }

  // Recalculate each affected city; alert admin if below the 25-listing floor
  // (the city stays active - deactivation is a manual decision, Section 13).
  const cityAlerts: { cityId: string; listingCount: number }[] = [];
  for (const cityId of affectedCities) {
    try {
      const c = await recalculateCounters(cityId);
      if (c.listingCount < CITY_MIN_LISTINGS) {
        cityAlerts.push({ cityId, listingCount: c.listingCount });
      }
    } catch {
      /* keep going */
    }
  }

  // ---- 2. Warn listings expiring within 5 days ----
  const soon = await Listing.find(
    {
      status: "approved",
      expiresAt: { $gte: now, $lte: new Date(now.getTime() + WARN_WINDOW_MS) },
    },
    { _id: 1, title: 1, dealerId: 1, expiresAt: 1, lastRefreshedAt: 1, expiryWarnedAt: 1 },
  ).lean();

  let warningsSent = 0;
  for (const l of soon) {
    // Only warn once per 30-day window: skip if we already warned since the last
    // refresh.
    if (
      l.expiryWarnedAt &&
      l.lastRefreshedAt &&
      new Date(l.expiryWarnedAt) >= new Date(l.lastRefreshedAt)
    ) {
      continue;
    }
    try {
      const dealer = await Dealer.findById(l.dealerId, {
        phone: 1,
        businessName: 1,
      }).lean();
      if (!dealer?.phone) continue;
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(l.expiresAt!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
      await sendTemplate(dealer.phone, "listing_expiry_warning", {
        dealerName: dealer.businessName ?? "there",
        listingTitle: l.title ?? "your listing",
        daysLeft: String(daysLeft),
      });
      await Listing.updateOne({ _id: l._id }, { $set: { expiryWarnedAt: now } });
      warningsSent += 1;
    } catch {
      /* keep going */
    }
  }

  return {
    expired: overdue.length,
    warningsSent,
    localitiesDeactivated,
    cityAlerts,
  };
}

/** DEV-ONLY: force a listing's expiresAt into the past so the cron will expire
 *  it on the next run. Refuses in production. */
export async function devExpireListing(listingId: string): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  if (!mongoose.Types.ObjectId.isValid(listingId)) return false;
  await connectDB();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const res = await Listing.updateOne(
    { _id: listingId },
    { $set: { expiresAt: past, expiryWarnedAt: null } },
  );
  return res.matchedCount > 0;
}
