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

    // source. The fixed buyer-contact sources PLUS a generic "tool_<name>" family
    // for lead-magnet tools (stamp-duty calculator, etc.) — validated by shape so
    // new tools never need a schema change.
    source: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) =>
          ["listing", "generic", "ad", "agent_profile", "whatsapp_click"].includes(v) ||
          /^tool_[a-z0-9_]+$/.test(v),
        message: (props: { value: string }) => `${props.value} is not a valid lead source`,
      },
    },
    listingId: { type: Types.ObjectId, ref: "Listing" }, // null if generic / tool
    // Other listings the SAME buyer enquired on after this lead was created.
    // Secondary context only — the primary listingId and the assignment never
    // move. Views only surface entries owned by the assigned dealer.
    otherListingIds: { type: [{ type: Types.ObjectId, ref: "Listing" }], default: [] },

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
    // AI qualification outputs (from the n8n workflow, Section 11). isQualified
    // gates routing (Phase 5-next); stage tracks the conversation funnel.
    isQualified: { type: Boolean, default: false },
    stage: {
      type: String,
      enum: ["greeting", "qualifying", "qualified", "closing"],
    },

    // assignment - EXCLUSIVE
    assignedDealerId: { type: Types.ObjectId, ref: "Dealer" },
    // The dealer this enquiry was FOR when it could not be assigned (quota full).
    // Lets an admin see the original target while the lead sits unassigned (STEP 3.3).
    intendedDealerId: { type: Types.ObjectId, ref: "Dealer", default: null },
    // Why an "unassigned" lead is unassigned: "quota_exhausted" (dealer full).
    // Null for tool leads (which are unassigned by nature, not by quota).
    unassignedReason: { type: String, default: null },
    assignedAt: { type: Date },
    isLocked: { type: Boolean, default: true }, // NEVER auto-reassign once viewed

    // SLA + reassignment (Section 12). The assigned dealer must VIEW the lead
    // (reveal the buyer phone) before slaDeadline, else the SLA cron transfers it
    // to the next eligible dealer. whatsapp_click leads are exempt (the chat is
    // already on the dealer's WhatsApp).
    viewedAt: { type: Date, default: null },
    slaDeadline: { type: Date, default: null }, // = assignedAt + 30 min
    deliveredAt: { type: Date, default: null }, // whatsapp_click delivery time
    // Total reassignments (auto + manual), for display.
    reassignCount: { type: Number, default: 0 },
    // ONLY the SLA cron's automatic reassignments — the 3-transfer auto limit is
    // counted against this, so unlimited admin manual reassigns never exhaust it.
    autoReassignCount: { type: Number, default: 0 },
    assignmentHistory: {
      type: [
        new Schema(
          {
            dealerId: { type: Types.ObjectId, ref: "Dealer" },
            assignedAt: { type: Date },
            viewedAt: { type: Date, default: null },
            reason: { type: String, enum: ["initial", "sla_timeout", "manual"] },
            note: { type: String }, // admin note on a manual reassign
          },
          { _id: false },
        ),
      ],
      default: [],
    },

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
        // Routing outcome (Section 12): the listing's owner dealer is over quota.
        // Sits in the admin queue; the dealer is nudged to upgrade.
        "quota-exceeded",
        // SLA cron exhausted all reassign attempts (or found no eligible dealer):
        // sits in the admin queue for manual placement.
        "unclaimed",
        // WhatsApp-click lead: delivered straight to the dealer's WhatsApp.
        "delivered",
        // Lead-magnet TOOL lead: captured from a calculator, NEVER auto-assigned.
        // Sits in the admin queue until an admin manually assigns a dealer.
        "unassigned",
      ],
      default: "new",
    },
    dealerNotes: { type: String },

    // True when this buyer arrived via a property-alert link (Phase 3) — a
    // high-intent signal surfaced to the admin. Set from a short-lived cookie
    // stamped when the buyer opens an alert; never changes the lead's routing.
    fromAlert: { type: Boolean, default: false },

    // Lead-magnet tool payload (source "tool_*"): the tool's own input + output,
    // shown to the admin so they can judge how serious the lead is. Generic Mixed
    // so any future tool stores its shape without a schema change.
    toolData: {
      type: new Schema(
        {
          tool: { type: String }, // e.g. "stamp_duty"
          input: { type: Schema.Types.Mixed },
          output: { type: Schema.Types.Mixed },
          capturedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: null,
    },

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
// SLA cron: unviewed + past-deadline leads.
leadSchema.index({ status: 1, viewedAt: 1, slaDeadline: 1 });
// Admin filter: leads by source + status (e.g. unassigned tool leads), newest first.
leadSchema.index({ source: 1, status: 1, createdAt: -1 });
// Admin "Quota exhausted" filter — only the parked-by-quota leads (STEP 3.3).
leadSchema.index(
  { unassignedReason: 1, createdAt: -1 },
  { partialFilterExpression: { unassignedReason: { $type: "string" } } },
);

export type LeadDoc = InferSchemaType<typeof leadSchema>;

export const Lead: Model<LeadDoc> =
  (models.Lead as Model<LeadDoc>) ?? model<LeadDoc>("Lead", leadSchema);

export default Lead;
