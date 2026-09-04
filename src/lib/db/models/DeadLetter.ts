import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Dead-letter collection for outbound WhatsApp messages that failed after all
 * retries (DEV-SPEC.txt Section 11: "Failed messages -> dead letter collection,
 * admin dashboard"). Kept so an admin can inspect + manually re-send.
 */
const deadLetterSchema = new Schema(
  {
    channel: { type: String, default: "whatsapp" },
    to: { type: String, required: true },
    kind: { type: String, enum: ["text", "template"], required: true },
    templateName: { type: String },
    /** The full Cloud API payload we tried to send, for replay. */
    payload: { type: Schema.Types.Mixed },
    lastError: { type: String },
    attempts: { type: Number, default: 0 },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

deadLetterSchema.index({ resolved: 1, createdAt: -1 });

export type DeadLetterDoc = InferSchemaType<typeof deadLetterSchema>;

export const DeadLetter: Model<DeadLetterDoc> =
  (models.DeadLetter as Model<DeadLetterDoc>) ??
  model<DeadLetterDoc>("DeadLetter", deadLetterSchema);

export default DeadLetter;
