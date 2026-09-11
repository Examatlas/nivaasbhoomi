import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

import { computeVerificationTier, effectiveVerificationTier } from "@/lib/dealers/tier";
import { DEFAULT_MONTHLY_QUOTA } from "@/lib/leads/quota-config";

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
    // Set when this Dealer was created by (or linked to) a buyer User upgrade.
    userId: { type: Types.ObjectId, ref: "User", default: null },
    phone: { type: String, required: true, trim: true }, // WhatsApp number (partial-unique index below)
    // Set false whenever the dealer changes their phone; re-verification via
    // WhatsApp OTP is blocked (WABA unverified) — see the phone route's TODO.
    phoneVerified: { type: Boolean, default: false },
    // email is the login identity under AUTH_METHOD=password (unique, sparse so
    // OTP-created dealers without an email still validate). passwordHash is set
    // at email/password signup; absent for OTP-created dealers.
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    // A requested-but-unverified new email. Swapped into `email` only after the
    // dealer clicks the verification link sent to THIS address (never written
    // directly). Not unique — a transient collision is resolved at verify time.
    pendingEmail: { type: String, trim: true, lowercase: true, default: null },
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
    // Staff member who onboarded this dealer (null for admin/self-signup). The
    // basis for staff scoping — a staff sees only dealers they onboarded (∪
    // approved AccessRequests).
    onboardedBy: { type: Types.ObjectId, ref: "Staff", default: null },

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

    // plan / quota (STEP 3: 30/month, reset on the 1st — see lib/leads/quota-*)
    plan: { type: String, enum: ["free", "starter", "pro"], default: "free" },
    maxLeadsPerMonth: { type: Number, default: DEFAULT_MONTHLY_QUOTA },
    leadsUsedThisMonth: { type: Number, default: 0 },
    quotaResetAt: { type: Date },
    // Last time the calendar-month reset zeroed leadsUsedThisMonth. Used to make
    // the daily reset cron idempotent (skip a dealer already reset this month).
    lastResetAt: { type: Date, default: null },
    planExpiresAt: { type: Date },

    // status
    // "pending"  = created via self-signup / buyer upgrade, awaiting admin approval.
    // "rejected" = admin declined the signup (reason emailed to the dealer).
    // Neither is "active", so both are excluded from ALL lead routing (rotation,
    // listing-owner and agent-profile paths all gate on status === "active") and
    // are blocked from creating listings — until an admin sets it "active".
    status: {
      type: String,
      enum: ["active", "paused", "banned", "pending", "rejected"],
      default: "active",
    },
    // Admin's reason when status is "rejected" — surfaced to the dealer by email.
    rejectionReason: { type: String, default: null },
    // Anti-spam: FLAGGED (never blocked) when another dealer already uses this
    // exact business name in an overlapping coverage city. Admin reviews it.
    duplicateFlagged: { type: Boolean, default: false },
    duplicateReason: { type: String, default: null },
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
    // Per-dealer Zenith Code OAuth connection. Tokens are stored ENCRYPTED
    // (settings/crypto) and never leave the server. Zenith issues a permanent
    // access token, so refresh/expiry stay null (kept for forward-compat).
    zenithAccessTokenEnc: { type: String, default: null },
    zenithRefreshTokenEnc: { type: String, default: null },
    zenithTokenExpiresAt: { type: Date, default: null },
    zenithNumber: { type: String, default: null }, // registered WhatsApp number on Zenith
    zenithPlan: { type: String, default: null }, // free / paid / plan name
    zenithConnectedAt: { type: Date, default: null },
    // The bound Zenith organization/account id. One Zenith account binds to
    // exactly one dealer (enforced by the partial-unique index below).
    zenithOrgId: { type: String, default: null },

    // ---- Agent API key (P3) — the dealer's Zenith AI agent authenticates with
    // this to read ONLY this dealer's data. We store a SHA-256 HASH (never the
    // plaintext), plus the last 4 chars for display. Regenerating replaces the
    // hash, so the old key dies instantly. Indexed (sparse-unique) below.
    agentApiKeyHash: { type: String, default: null },
    agentApiKeyLast4: { type: String, default: null },
    agentApiKeyCreatedAt: { type: Date, default: null },
    agentApiKeyLastUsedAt: { type: Date, default: null },

    // ---- Public profile (Phase 2+) — slug infra ----
    // Old slugs kept so they 301-redirect to the current one (never 404).
    slugHistory: { type: [String], default: [] },
    // The 30-day change lock starts from the FIRST MANUAL slug change, not signup.
    slugLockUntil: { type: Date, default: null },
    slugManuallyChangedAt: { type: Date, default: null },

    // ---- Public profile — branding ----
    bannerImage: {
      type: new Schema({ url: String, publicId: String }, { _id: false }),
      default: null,
    },
    logoImage: {
      type: new Schema({ url: String, publicId: String }, { _id: false }),
      default: null,
    },

    // ---- Public profile — business ----
    tagline: { type: String, trim: true, maxlength: 120 },
    establishedYear: { type: Number },
    about: { type: String }, // 500–2000 chars, SERVER-SANITIZED before save

    // ---- Public profile — offering ----
    dealTypes: {
      type: [{ type: String, enum: ["plot", "flat", "house", "commercial", "rent", "resale"] }],
      default: [],
    },
    // serviceAreas REUSE coverageCities / coverageLocalities (one source of truth).

    // ---- Public profile — details ----
    priceRangeMin: { type: Number },
    priceRangeMax: { type: Number },
    reraNumber: { type: String, trim: true }, // public registry data
    gstNumber: { type: String, trim: true },
    languages: { type: [String], default: [] },
    yearsExperience: { type: Number },
    teamSize: { type: Number },

    // ---- Public profile — contact ----
    officeAddress: { type: String, trim: true },
    mapLat: { type: Number },
    mapLng: { type: Number },
    workingHours: {
      type: [
        new Schema(
          { day: String, open: String, close: String, closed: { type: Boolean, default: false } },
          { _id: false },
        ),
      ],
      default: [],
    },
    publicEmail: { type: String, trim: true, lowercase: true },
    // Email/phone are exposed publicly ONLY when the dealer opts in (Section 13).
    publicEmailOptIn: { type: Boolean, default: false },
    publicPhoneOptIn: { type: Boolean, default: false },

    // ---- Verification documents — PRIVATE, admin-only. Never public. ----
    verificationDocs: {
      type: [
        new Schema(
          {
            type: { type: String },
            url: { type: String },
            publicId: { type: String },
            verified: { type: Boolean, default: false },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
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

// Section 5 indexes. { slug:1 } unique comes from field options.
// Phone is the login identity (WhatsApp OTP): partial-unique so it's enforced
// whenever present (always — required) without null collisions.
dealerSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
// Link to the buyer User this dealer was upgraded from (present only after link).
dealerSchema.index({ userId: 1 }, { sparse: true });
// Agent API key lookup: hash → dealer. Sparse-unique so two dealers can never
// share a key and dealers without a key don't collide on null.
dealerSchema.index(
  { agentApiKeyHash: 1 },
  { unique: true, partialFilterExpression: { agentApiKeyHash: { $type: "string" } } },
);
dealerSchema.index({ coverageCities: 1, status: 1 });
dealerSchema.index({ coverageLocalities: 1, verificationTier: -1, rating: -1 });
// Resolve an old slug -> its dealer for the 301 redirect (never 404).
dealerSchema.index({ slugHistory: 1 });
dealerSchema.index({ onboardedBy: 1 }, { sparse: true }); // staff scoping
// One Zenith account -> one dealer. A PARTIAL unique index (only where
// zenithOrgId is a string) rather than a plain sparse unique index, because a
// sparse unique index still collides on explicit null values (disconnect sets
// null); the partial filter indexes only connected dealers.
dealerSchema.index(
  { zenithOrgId: 1 },
  { unique: true, partialFilterExpression: { zenithOrgId: { $type: "string" } } },
);

export type DealerDoc = InferSchemaType<typeof dealerSchema>;

export const Dealer: Model<DealerDoc> =
  (models.Dealer as Model<DealerDoc>) ?? model<DealerDoc>("Dealer", dealerSchema);

export default Dealer;
