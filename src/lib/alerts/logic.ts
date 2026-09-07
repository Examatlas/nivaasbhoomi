import mongoose from "mongoose";

import { groupINR } from "@/lib/utils/price";

/**
 * Pure property-alert rules (no DB, no I/O) so the anti-spam and matching logic
 * is exhaustively unit-tested. The cron/notify layer calls these.
 */

export const MAX_ACTIVE_ALERTS = 5; // per buyer
export const ALERT_DEDUP_HOURS = 24; // one alert per phone per 24h
export const AUTO_PAUSE_AFTER = 3; // un-visited alerts before auto-pause
export const IST_OFFSET_MIN = 330; // UTC+5:30
export const ALERT_WINDOW_START_HOUR = 9; // 9am IST
export const ALERT_WINDOW_END_HOUR = 20; // 8pm IST

/** Minutes since IST midnight for a given instant. */
export function istMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
}

/** Send window: 9am–8pm IST (inclusive of 9:00, exclusive of 20:00). */
export function isWithinAlertWindowIST(now: Date): boolean {
  const h = Math.floor(istMinutes(now) / 60);
  return h >= ALERT_WINDOW_START_HOUR && h < ALERT_WINDOW_END_HOUR;
}

/** A search should auto-pause once this many alerts went un-visited. */
export function shouldAutoPause(alertsSinceVisit: number): boolean {
  return alertsSinceVisit >= AUTO_PAUSE_AFTER;
}

export interface AlertCriteria {
  cityId: unknown;
  localityIds?: unknown[];
  propertyType?: string | null;
  purpose: "buy" | "rent";
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: string | null;
}

/** Build the Mongo filter that finds NEW approved listings matching a saved
 *  search (created after `since`). Pure — returned filter is unit-tested.
 *  purpose "buy" → sale listings priced on expectedPrice; "rent" → monthlyRent. */
export function buildListingMatchFilter(criteria: AlertCriteria, since: Date): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    status: "approved",
    cityId: new mongoose.Types.ObjectId(String(criteria.cityId)),
    createdAt: { $gt: since },
    purpose: criteria.purpose === "rent" ? "rent" : "sale",
  };

  const locs = (criteria.localityIds ?? []).filter(Boolean);
  if (locs.length > 0) {
    filter.localityId = { $in: locs.map((l) => new mongoose.Types.ObjectId(String(l))) };
  }
  if (criteria.propertyType) filter.propertyType = criteria.propertyType;
  if (criteria.bedrooms) filter.bhk = criteria.bedrooms;

  const priceField = criteria.purpose === "rent" ? "monthlyRent" : "expectedPrice";
  const range: Record<string, number> = {};
  if (typeof criteria.budgetMin === "number") range.$gte = criteria.budgetMin;
  if (typeof criteria.budgetMax === "number") range.$lte = criteria.budgetMax;
  if (Object.keys(range).length > 0) filter[priceField] = range;

  return filter;
}

/** Human budget range for the alert template ({{4}}), Indian grouping. */
export function formatBudgetRange(min?: number | null, max?: number | null): string {
  if (typeof min === "number" && typeof max === "number") return `₹${groupINR(min)}–₹${groupINR(max)}`;
  if (typeof max === "number") return `up to ₹${groupINR(max)}`;
  if (typeof min === "number") return `₹${groupINR(min)}+`;
  return "any budget";
}
