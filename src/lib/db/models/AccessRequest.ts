import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * A staff member's request for access to a dealer they did NOT onboard. An admin
 * approves or rejects it; an approved request grants that staff a scoped view of
 * that dealer (the staff scope = onboarded dealers ∪ approved-access dealers).
 */
const accessRequestSchema = new Schema(
  {
    staffId: { type: Types.ObjectId, ref: "Staff", required: true },
    dealerId: { type: Types.ObjectId, ref: "Dealer", required: true },
    reason: { type: String, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String }, // admin email
    adminNote: { type: String, trim: true },
  },
  { timestamps: true },
);

// Staff's own requests (+ pending count for the rate limit); admin queue by dealer.
accessRequestSchema.index({ staffId: 1, status: 1 });
accessRequestSchema.index({ dealerId: 1, status: 1 });
// One live request per (staff, dealer): a partial-unique guard on pending rows.
accessRequestSchema.index(
  { staffId: 1, dealerId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export type AccessRequestDoc = InferSchemaType<typeof accessRequestSchema>;

export const AccessRequest: Model<AccessRequestDoc> =
  (models.AccessRequest as Model<AccessRequestDoc>) ??
  model<AccessRequestDoc>("AccessRequest", accessRequestSchema);

export default AccessRequest;
