import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { MAX_ACTIVE_ALERTS } from "@/lib/alerts/logic";

export interface SavedSearchCriteriaInput {
  cityId: string;
  localityIds?: string[];
  propertyType?: string | null;
  purpose: "buy" | "rent";
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: string | null;
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string; code: "LIMIT" | "INVALID" };

/** Count a phone's ACTIVE, subscribed alerts (the 5-alert cap applies to these). */
export async function activeAlertCount(phone: string): Promise<number> {
  await connectDB();
  return SavedSearch.countDocuments({ phone, active: true, unsubscribedAt: null });
}

export async function createSavedSearch(args: {
  userId: string | null;
  phone: string;
  criteria: SavedSearchCriteriaInput;
}): Promise<CreateResult> {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(args.criteria.cityId)) {
    return { ok: false, error: "Invalid city.", code: "INVALID" };
  }
  if ((await activeAlertCount(args.phone)) >= MAX_ACTIVE_ALERTS) {
    return {
      ok: false,
      code: "LIMIT",
      error: `You already have ${MAX_ACTIVE_ALERTS} active alerts — pause or delete one first.`,
    };
  }
  const c = args.criteria;
  const doc = await SavedSearch.create({
    userId: args.userId ? new mongoose.Types.ObjectId(args.userId) : null,
    phone: args.phone,
    criteria: {
      cityId: new mongoose.Types.ObjectId(c.cityId),
      localityIds: (c.localityIds ?? [])
        .filter((l) => mongoose.Types.ObjectId.isValid(l))
        .map((l) => new mongoose.Types.ObjectId(l)),
      propertyType: c.propertyType ?? null,
      purpose: c.purpose,
      budgetMin: typeof c.budgetMin === "number" ? c.budgetMin : null,
      budgetMax: typeof c.budgetMax === "number" ? c.budgetMax : null,
      bedrooms: c.bedrooms ?? null,
    },
    // Creating an alert opts the phone back in (clears any prior unsubscribe).
    unsubscribedAt: null,
    active: true,
  });
  return { ok: true, id: String(doc._id) };
}

/** Reset the auto-pause counter for a phone (they came back via an alert link). */
export async function recordAlertVisit(phone: string): Promise<void> {
  await connectDB();
  await SavedSearch.updateMany(
    { phone },
    { $set: { alertsSinceVisit: 0, lastVisitedAt: new Date() } },
  );
}

/** Unsubscribe a phone from ALL alerts (never notify again until re-enabled). */
export async function unsubscribeAll(phone: string): Promise<number> {
  await connectDB();
  const res = await SavedSearch.updateMany(
    { phone },
    { $set: { unsubscribedAt: new Date(), active: false } },
  );
  return res.modifiedCount ?? 0;
}

/** Re-enable alerts a phone had unsubscribed. */
export async function resubscribeAll(phone: string): Promise<void> {
  await connectDB();
  await SavedSearch.updateMany({ phone }, { $set: { unsubscribedAt: null, active: true } });
}
