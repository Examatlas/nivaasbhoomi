import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Dealer email-change token store. Like the password-reset token, the raw token
 * is never stored — only an HMAC of it (keyed by JWT_SECRET). A TTL index drops
 * each document shortly after it expires. The token binds a specific dealer to a
 * specific NEW email; verifying it swaps pendingEmail -> email.
 */
const emailChangeTokenSchema = new Schema(
  {
    dealerId: { type: Schema.Types.ObjectId, ref: "Dealer", required: true, index: true },
    newEmail: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, index: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL: drop the document once expiresAt passes.
emailChangeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailChangeTokenSchema.index({ dealerId: 1, createdAt: -1 });

export type EmailChangeTokenDoc = InferSchemaType<typeof emailChangeTokenSchema>;

export const EmailChangeToken: Model<EmailChangeTokenDoc> =
  (models.EmailChangeToken as Model<EmailChangeTokenDoc>) ??
  model<EmailChangeTokenDoc>("EmailChangeToken", emailChangeTokenSchema);

export default EmailChangeToken;
