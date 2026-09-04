import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Retry queue for failed n8n forwards (DEV-SPEC.txt Section 11: "Add a retry
 * queue for failed n8n calls"). A background worker (a later cron) re-posts
 * pending entries; here we only enqueue on failure so nothing is lost.
 */
const n8nRetrySchema = new Schema(
  {
    /** The exact payload we tried to POST to N8N_WEBHOOK_URL. */
    payload: { type: Schema.Types.Mixed, required: true },
    phone: { type: String },
    messageId: { type: String },
    lastError: { type: String },
    attempts: { type: Number, default: 0 },
    /** When the retry worker should next try (simple backoff). */
    nextAttemptAt: { type: Date, default: () => new Date() },
    status: {
      type: String,
      enum: ["pending", "done", "abandoned"],
      default: "pending",
    },
  },
  { timestamps: true },
);

n8nRetrySchema.index({ status: 1, nextAttemptAt: 1 });
// De-dupe: never queue the same inbound message twice.
n8nRetrySchema.index(
  { messageId: 1 },
  { unique: true, partialFilterExpression: { messageId: { $type: "string" } } },
);

export type N8nRetryDoc = InferSchemaType<typeof n8nRetrySchema>;

export const N8nRetry: Model<N8nRetryDoc> =
  (models.N8nRetry as Model<N8nRetryDoc>) ??
  model<N8nRetryDoc>("N8nRetry", n8nRetrySchema);

export default N8nRetry;
