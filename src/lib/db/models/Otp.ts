import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Login OTP store (collection: otps). The 6-digit code is stored ONLY as a
 * bcrypt hash, never in the clear. A TTL index expires each code after 10
 * minutes. Exactly one active OTP per phone — the send route deletes any prior
 * code for a number before inserting the new one.
 */
const otpSchema = new Schema({
  phone: { type: String, required: true, index: true }, // canonical "91XXXXXXXXXX"
  codeHash: { type: String, required: true }, // bcrypt
  purpose: { type: String, enum: ["login"], default: "login", required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// TTL: drop the OTP 600s after it was created.
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export type OtpDoc = InferSchemaType<typeof otpSchema>;

export const Otp: Model<OtpDoc> =
  (models.Otp as Model<OtpDoc>) ?? model<OtpDoc>("Otp", otpSchema);

export default Otp;
