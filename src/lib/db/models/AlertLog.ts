import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per property-alert WhatsApp SEND (Phase 3). Powers the 24h-per-phone
 * anti-spam guard, the admin analytics (sends, delivery rate, unsubscribes), and
 * an audit trail. A send may cover several saved searches merged into one
 * message — hence searchIds[] and the listing count.
 */
const alertLogSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true },
    searchIds: { type: [{ type: Types.ObjectId, ref: "SavedSearch" }], default: [] },
    cityId: { type: Types.ObjectId, ref: "City", default: null },
    listingCount: { type: Number, default: 0 },
    messageId: { type: String, default: null },
    status: { type: String, enum: ["sent", "failed"], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// 24h dedup lookup by phone, and admin listing newest-first.
alertLogSchema.index({ phone: 1, createdAt: -1 });
alertLogSchema.index({ createdAt: -1 });

export type AlertLogDoc = InferSchemaType<typeof alertLogSchema>;

export const AlertLog: Model<AlertLogDoc> =
  (models.AlertLog as Model<AlertLogDoc>) ?? model<AlertLogDoc>("AlertLog", alertLogSchema);

export default AlertLog;
