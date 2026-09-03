import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * Lead (DEV-SPEC.txt Section 4).
 *
 * Assignment is EXCLUSIVE and LOCKED: once assignedDealerId is set, isLocked
 * stays true and the lead is NEVER reassigned (Section 4/12). The routing engine
 * is Phase 5; this model just holds the shape and lifecycle.
 *
 * PRIVACY (Section 13): lead.* is private to the assigned dealer - enforced at
 * the API layer.
 */
const leadSchema = new Schema(
  {
    // buyer
    phone: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    waProfileName: { type: String },

    // source
    source: { type: String, enum: ["listing", "generic", "ad"], required: true },
    listingId: { type: Types.ObjectId, ref: "Listing" }, // null if generic

    // location intent
    cityId: { type: Types.ObjectId, ref: "City" },
    localityId: { type: Types.ObjectId, ref: "Locality" },

    // qualification (AI fills these)
    purpose: { type: String }, // 'buy' | 'rent'
    propertyType: { type: String },
    bhk: { type: String },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    timeline: { type: String }, // 'immediate','1-3m','3-6m','6m+'
    loanRequired: { type: Boolean },
    siteVisitSlot: { type: String },
    qualificationScore: { type: Number, min: 0, max: 100 },

    // assignment - EXCLUSIVE
    assignedDealerId: { type: Types.ObjectId, ref: "Dealer" },
    assignedAt: { type: Date },
    isLocked: { type: Boolean, default: true }, // NEVER reassign

    // lifecycle
    status: {
      type: String,
      enum: [
        "new",
        "assigned",
        "contacted",
        "site-visit-scheduled",
        "site-visit-done",
        "converted",
        "lost",
        "unmatched",
      ],
      default: "new",
    },
    dealerNotes: { type: String },

    // review
    reviewRating: { type: Number, min: 1, max: 5 },
    reviewComment: { type: String },
    reviewedAt: { type: Date },

    firstResponseMinutes: { type: Number }, // response-time badge
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Section 5 indexes.
leadSchema.index({ phone: 1, createdAt: -1 });
leadSchema.index({ assignedDealerId: 1, status: 1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ listingId: 1 });

export type LeadDoc = InferSchemaType<typeof leadSchema>;

export const Lead: Model<LeadDoc> =
  (models.Lead as Model<LeadDoc>) ?? model<LeadDoc>("Lead", leadSchema);

export default Lead;
