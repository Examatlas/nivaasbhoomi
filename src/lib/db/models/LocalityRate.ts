import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * LocalityRate — a per-locality price aggregate (Phase 4A, data layer only).
 * Recomputed by the compute-locality-rates cron from approved listings.
 * dataQuality gates public exposure (P4B): "insufficient" must NEVER be shown.
 */
const localityRateSchema = new Schema(
  {
    localityId: { type: Types.ObjectId, ref: "Locality", required: true },
    cityId: { type: Types.ObjectId, ref: "City", required: true },
    stateId: { type: Types.ObjectId, ref: "State", default: null },

    propertyType: { type: String, enum: ["flat", "plot", "house", "commercial", "farmhouse"], required: true },
    purpose: { type: String, enum: ["buy", "rent"], required: true },

    sampleCount: { type: Number, default: 0 },
    medianPricePerSqft: { type: Number, default: null },
    minPricePerSqft: { type: Number, default: null },
    maxPricePerSqft: { type: Number, default: null },
    p25PricePerSqft: { type: Number, default: null },
    p75PricePerSqft: { type: Number, default: null },
    medianTotalPrice: { type: Number, default: null },

    dataQuality: {
      type: String,
      enum: ["sufficient", "low", "insufficient"],
      default: "insufficient",
    },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One aggregate per locality + type + purpose (idempotent upsert key).
localityRateSchema.index({ localityId: 1, propertyType: 1, purpose: 1 }, { unique: true });
// Admin dashboard: how many localities are public-ready per city.
localityRateSchema.index({ cityId: 1, dataQuality: 1 });

export type LocalityRateDoc = InferSchemaType<typeof localityRateSchema>;

export const LocalityRate: Model<LocalityRateDoc> =
  (models.LocalityRate as Model<LocalityRateDoc>) ??
  model<LocalityRateDoc>("LocalityRate", localityRateSchema);

export default LocalityRate;
