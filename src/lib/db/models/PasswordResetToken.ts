import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Password-reset token store (email-based recovery). The token is never stored
 * in the clear — only an HMAC of it (keyed by JWT_SECRET), like the OTP store.
 * A TTL index deletes each token shortly after it expires. `role` scopes the
 * token to a buyer (User) or a Dealer so the two account spaces never collide.
 */
const passwordResetTokenSchema = new Schema(
  {
    role: { type: String, enum: ["user", "dealer"], required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, index: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL: drop the document once expiresAt passes.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ role: 1, email: 1, createdAt: -1 });

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema>;

export const PasswordResetToken: Model<PasswordResetTokenDoc> =
  (models.PasswordResetToken as Model<PasswordResetTokenDoc>) ??
  model<PasswordResetTokenDoc>("PasswordResetToken", passwordResetTokenSchema);

export default PasswordResetToken;
