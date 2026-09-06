import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Buyer (User) — the person browsing listings who signs up before contacting a
 * dealer. NivaasBhoomi's own login, separate from the Dealer account.
 *
 * Auth is switchable (see lib/config/flags authMethod):
 *   - "password" (launch): email + passwordHash are the identity. The phone is
 *     captured at signup and STORED but NOT verified yet — it's what the dealer
 *     calls. So phone is required-at-signup (enforced in the route) but not
 *     unique (unverified, may repeat across family members).
 *   - "whatsapp": a buyer is created from a verified phone with no email. email
 *     is therefore optional + sparse-unique so both paths coexist.
 *
 * emailVerified is reserved for a future email-verification step (Resend/SES);
 * launch does password-only, so it stays false and nothing gates on it yet.
 */
const userSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true }, // canonical "91XXXXXXXXXX"
    phoneVerified: { type: Boolean, default: false }, // true once a login OTP is confirmed
    email: { type: String, trim: true, lowercase: true }, // optional; partial-unique index below
    passwordHash: { type: String },
    emailVerified: { type: Boolean, default: false },
    name: { type: String, trim: true },
    waProfileName: { type: String, trim: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Phone is the login identity under WhatsApp OTP. Partial-unique so it's enforced
// whenever a phone is present (it always is — required), without null collisions.
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);
// Email is optional (most buyers have none). Partial-unique so it is enforced
// only when present — no null collisions.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);

export default User;
