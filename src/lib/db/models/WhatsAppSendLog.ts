import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per outbound WhatsApp send (OTP + business templates), for the
 * /api/admin/whatsapp/health dashboard. Never stores the OTP code or any PII —
 * only transport metadata. Auto-expires after 30 days (TTL index).
 */
const whatsAppSendLogSchema = new Schema({
  // "zenith" | "meta" | "meta_fallback"
  provider: { type: String, required: true },
  template: { type: String, required: true },
  delivered: { type: Boolean, required: true },
  status: { type: Number }, // HTTP status (undefined on network/timeout)
  messageId: { type: String },
  error: { type: String },
  fellBack: { type: Boolean, default: false }, // true when Zenith failed → Meta
  createdAt: { type: Date, default: Date.now },
});

// TTL: drop rows after 30 days (the health view only needs the last 24h).
whatsAppSendLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export type WhatsAppSendLogDoc = InferSchemaType<typeof whatsAppSendLogSchema>;

export const WhatsAppSendLog: Model<WhatsAppSendLogDoc> =
  (models.WhatsAppSendLog as Model<WhatsAppSendLogDoc>) ??
  model<WhatsAppSendLogDoc>("WhatsAppSendLog", whatsAppSendLogSchema);

export default WhatsAppSendLog;
