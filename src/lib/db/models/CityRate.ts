import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * CityRate — a per-city price aggregate (Phase 4A). A coarser fallback for when
 * a locality has too little data. Same shape/rules as LocalityRate.
 */
const cityRateSchema = new Schema(
  {
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

cityRateSchema.index({ cityId: 1, propertyType: 1, purpose: 1 }, { unique: true });
cityRateSchema.index({ dataQuality: 1 });

export type CityRateDoc = InferSchemaType<typeof cityRateSchema>;

export const CityRate: Model<CityRateDoc> =
  (models.CityRate as Model<CityRateDoc>) ?? model<CityRateDoc>("CityRate", cityRateSchema);

export default CityRate;
