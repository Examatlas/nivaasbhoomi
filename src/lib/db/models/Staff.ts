import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Staff (employee) account — an internal user below admin, with its own
 * email+password login and a scoped view (only the dealers they onboarded, plus
 * any granted via an approved AccessRequest).
 *
 * `tokenVersion` powers instant session revocation: deactivating a staff (or a
 * password reset) bumps it, and requireStaff rejects any live JWT whose `tv`
 * no longer matches — so a deactivated employee is locked out immediately.
 */
const staffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: String }, // admin email that created this staff
  },
  { timestamps: true },
);

// Email is the login identity — unique.
staffSchema.index({ email: 1 }, { unique: true });

export type StaffDoc = InferSchemaType<typeof staffSchema>;

export const Staff: Model<StaffDoc> =
  (models.Staff as Model<StaffDoc>) ?? model<StaffDoc>("Staff", staffSchema);

export default Staff;
