import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

import { computeVerificationTier, effectiveVerificationTier } from "@/lib/dealers/tier";

/**
 * Dealer (DEV-SPEC.txt Section 4).
 *
 * verificationTier is DERIVED, never set directly - a pre-validate hook computes
 * it from the verified documents on every save (Section 13). An admin can pull
 * it down via verificationTierOverride, but can never push it above what the
 * documents earn.
 *
 * PRIVACY (Section 13): phone, email and documents.* are NEVER exposed publicly.
 * That is enforced at the API projection layer; the model stores them.
 */

const verifiableDoc = (extra: Record<string, unknown> = {}) => ({
  url: { type: String },
  verified: { type: Boolean, default: false },
  ...extra,
});

const documentsSchema = new Schema(
  {
    pan: verifiableDoc(),
    aadhaar: verifiableDoc(),
    gst: verifiableDoc({ number: { type: String } }),
    udyam: verifiableDoc({ number: { type: String } }),
    rera: verifiableDoc({
      number: { type: String },
      stateId: { type: Types.ObjectId, ref: "State" },
    }),
    officePhoto: verifiableDoc({ lat: { type: Number }, lng: { type: Number } }),
  },
  { _id: false },
);

const dealerSchema = new Schema(
  {
    // identity
    name: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true }, // WhatsApp number
    // email is the login identity under AUTH_METHOD=password (unique, sparse so
    // OTP-created dealers without an email still validate). passwordHash is set
    // at email/password signup; absent for OTP-created dealers.
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true }, // public profile URL
    profilePhoto: { type: String },

    // coverage - lead routing base
    coverageCities: { type: [{ type: Types.ObjectId, ref: "City" }], default: [] },
    coverageLocalities: {
      type: [{ type: Types.ObjectId, ref: "Locality" }],
      default: [],
    },

    // verification (verificationTier is DERIVED - see hook)
    verificationTier: { type: Number, enum: [0, 1, 2, 3, 4], default: 0 },
    /**
     * Admin manual downgrade. When set, effective tier = min(computed, override).
     * Not in the spec's field list, but Section 13 requires "admin manually
     * downgrade kar sake" - this is where that cap lives.
     */
    verificationTierOverride: { type: Number, enum: [0, 1, 2, 3, 4], default: null },
    documents: { type: documentsSchema, default: () => ({}) },
    verificationNotes: { type: String }, // admin internal
    verifiedAt: { type: Date },
    verifiedBy: { type: Types.ObjectId },

    // rating
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // performance (public trust signals)
    avgResponseMinutes: { type: Number },
    totalLeadsReceived: { type: Number, default: 0 },
    totalSiteVisits: { type: Number, default: 0 },
    // Last time a lead was routed to this dealer - the round-robin fairness key
    // in the generic-lead ranking (Section 12). Null = never assigned.
    lastAssignedAt: { type: Date, default: null },

    // plan
    plan: { type: String, enum: ["free", "starter", "pro"], default: "free" },
    maxLeadsPerMonth: { type: Number, default: 10 },
    leadsUsedThisMonth: { type: Number, default: 0 },
    quotaResetAt: { type: Date },
    planExpiresAt: { type: Date },

    // status
    status: { type: String, enum: ["active", "paused", "banned"], default: "active" },
    listingCount: { type: Number, default: 0 },

    /**
     * Zenith Code automation link. FALSE for everyone at launch. When a dealer
     * later connects a Zenith-registered WhatsApp number (verified via the
     * Zenith Code API — a future phase), this flips to true and their listings'
     * button switches from "Contact Us" (lead → dashboard) to a WhatsApp button
     * that routes the buyer into the dealer's Zenith automation. See
     * resolveContactMode() in lib/leads/contact-mode.
     */
    zenithConnected: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

/**
 * Recompute verificationTier from the verified documents (+ site visits and
 * rating for tier 4) on every save, then apply any admin downgrade. This is the
 * single source of truth for the tier - callers never set it directly.
 */
dealerSchema.pre("validate", function () {
  const computed = computeVerificationTier({
    documents: this.documents,
    totalSiteVisits: this.totalSiteVisits,
    rating: this.rating,
  });
  this.verificationTier = effectiveVerificationTier(
    computed,
    this.verificationTierOverride,
  );
});

// Section 5 indexes. { phone:1 } and { slug:1 } unique come from field options.
dealerSchema.index({ coverageCities: 1, status: 1 });
dealerSchema.index({ coverageLocalities: 1, verificationTier: -1, rating: -1 });

export type DealerDoc = InferSchemaType<typeof dealerSchema>;

export const Dealer: Model<DealerDoc> =
  (models.Dealer as Model<DealerDoc>) ?? model<DealerDoc>("Dealer", dealerSchema);

export default Dealer;
