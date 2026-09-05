import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Buyer (User) — the person browsing listings who signs in with a WhatsApp OTP
 * before contacting a dealer. This is NivaasBhoomi's own login (its own Meta
 * app), entirely separate from the Dealer account. A buyer is created on their
 * first successful OTP verification.
 *
 * We keep only what's needed to route a "Contact Us" lead: the verified phone
 * (which becomes the Lead's buyer phone) and a display name.
 */
const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true }, // 91XXXXXXXXXX
    name: { type: String, trim: true },
    waProfileName: { type: String, trim: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);

export default User;
