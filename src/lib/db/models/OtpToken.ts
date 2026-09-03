import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * OTP token store for dealer WhatsApp login (DEV-SPEC.txt Section 8).
 *
 * The code is never stored in the clear - only an HMAC of it. A TTL index on
 * expiresAt makes Mongo delete each token ~10 minutes after it is issued, which
 * both enforces the OTP lifetime and keeps the rate-limit window self-cleaning
 * (a phone's recent sends are exactly the un-expired tokens it still has).
 */
const otpTokenSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL: remove the document once expiresAt passes.
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpTokenSchema.index({ phone: 1, createdAt: -1 });

export type OtpTokenDoc = InferSchemaType<typeof otpTokenSchema>;

export const OtpToken: Model<OtpTokenDoc> =
  (models.OtpToken as Model<OtpTokenDoc>) ??
  model<OtpTokenDoc>("OtpToken", otpTokenSchema);

export default OtpToken;
