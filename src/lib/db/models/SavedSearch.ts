import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * SavedSearch — a buyer's saved filter that triggers a WhatsApp "property alert"
 * when new matching listings appear (Phase 3, recurring engagement). NOT a lead.
 *
 * Anti-spam state lives here: lastNotifiedAt (only notify about listings newer
 * than this), alertsSinceVisit (auto-pause a dead audience after 3 un-visited
 * alerts), unsubscribedAt (never notify again once set — the buyer can re-enable).
 */
const savedSearchSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", default: null },
    phone: { type: String, required: true, trim: true }, // canonical 91XXXXXXXXXX

    criteria: {
      cityId: { type: Types.ObjectId, ref: "City", required: true },
      localityIds: { type: [{ type: Types.ObjectId, ref: "Locality" }], default: [] },
      propertyType: { type: String, default: null },
      purpose: { type: String, enum: ["buy", "rent"], required: true },
      budgetMin: { type: Number, default: null },
      budgetMax: { type: Number, default: null },
      bedrooms: { type: String, default: null }, // '1rk','1','2','3','4','5plus'
    },

    // "instant" is reserved for the future; only "daily" is honoured now.
    frequency: { type: String, enum: ["instant", "daily"], default: "daily" },
    active: { type: Boolean, default: true },

    lastNotifiedAt: { type: Date, default: null },
    lastSeenListingId: { type: Types.ObjectId, ref: "Listing", default: null },
    // Auto-pause tracking: alerts sent since the buyer last visited via an alert
    // link. Reset to 0 on a visit; at 3 the search auto-pauses.
    alertsSinceVisit: { type: Number, default: 0 },
    lastVisitedAt: { type: Date, default: null },
    // Set when the buyer unsubscribes — never notify again until they re-enable.
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Cron: active searches by city. Plus lookups by phone (dedup / My Alerts).
savedSearchSchema.index({ active: 1, "criteria.cityId": 1 });
savedSearchSchema.index({ phone: 1 });

export type SavedSearchDoc = InferSchemaType<typeof savedSearchSchema>;

export const SavedSearch: Model<SavedSearchDoc> =
  (models.SavedSearch as Model<SavedSearchDoc>) ??
  model<SavedSearchDoc>("SavedSearch", savedSearchSchema);

export default SavedSearch;
