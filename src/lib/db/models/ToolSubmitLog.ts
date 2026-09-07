import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per lead-magnet TOOL submission, used only for rate limiting
 * (5/hour/IP). A TTL index drops rows after an hour so the count is naturally
 * windowed — same pattern as OtpRequestLog / DealerSignupLog.
 */
const toolSubmitLogSchema = new Schema({
  ip: { type: String, index: true },
  tool: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// TTL: drop the log row 3600s after it was created (the rate window).
toolSubmitLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export type ToolSubmitLogDoc = InferSchemaType<typeof toolSubmitLogSchema>;

export const ToolSubmitLog: Model<ToolSubmitLogDoc> =
  (models.ToolSubmitLog as Model<ToolSubmitLogDoc>) ??
  model<ToolSubmitLogDoc>("ToolSubmitLog", toolSubmitLogSchema);

export default ToolSubmitLog;
