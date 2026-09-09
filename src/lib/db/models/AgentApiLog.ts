import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per dealer Agent API request (P3). Powers per-key rate limiting
 * (60/min, 2000/day) and the admin "requests today" / "last used" display.
 * NEVER stores the API key (only the resolved dealerId) or any buyer PII.
 * Auto-expires after 30 days (TTL index).
 */
const agentApiLogSchema = new Schema({
  dealerId: { type: Types.ObjectId, ref: "Dealer", required: true },
  endpoint: { type: String, required: true }, // "search" | "lead"
  status: { type: Number, required: true }, // HTTP status returned
  ms: { type: Number }, // handler duration
  createdAt: { type: Date, default: Date.now },
});

// Rate-window queries: count a dealer's rows in the last 60s / 24h.
agentApiLogSchema.index({ dealerId: 1, createdAt: -1 });
// TTL: drop rows after 30 days.
agentApiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export type AgentApiLogDoc = InferSchemaType<typeof agentApiLogSchema>;

export const AgentApiLog: Model<AgentApiLogDoc> =
  (models.AgentApiLog as Model<AgentApiLogDoc>) ??
  model<AgentApiLogDoc>("AgentApiLog", agentApiLogSchema);

export default AgentApiLog;
