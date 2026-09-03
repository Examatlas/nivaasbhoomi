import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * Locality (DEV-SPEC.txt Section 4).
 *
 * slug is unique WITHIN a city only, via the { cityId, slug } compound unique
 * index - "kanke-road" can exist in both Ranchi and Patna. It is NOT globally
 * unique, so never rely on slug alone to resolve a locality; always scope by
 * city.
 *
 * Activation is automatic (Section 13): a locality goes live only once its
 * status is 'approved', its introText is >= 500 chars, and it has >= 3 approved
 * listings. Seeded localities are status:'approved' but isActive:false and carry
 * no introText yet, so they stay off the public site until content + listings
 * exist.
 */
const faqSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const localitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    cityId: { type: Types.ObjectId, ref: "City", required: true },
    stateId: { type: Types.ObjectId, ref: "State", required: true },
    pincodes: { type: [String], default: [] },

    lat: { type: Number },
    lng: { type: Number },

    introText: { type: String }, // 150+ words, MANDATORY before activation
    connectivity: { type: String },
    metaTitle: { type: String },
    metaDescription: { type: String },
    faq: { type: [faqSchema], default: [] },

    rateRange: {
      // auto-calculated from live listings
      saleMin: { type: Number },
      saleMax: { type: Number },
      rentMin: { type: Number },
      rentMax: { type: Number },
      avgPricePerSqft: { type: Number },
      lastCalculated: { type: Date },
    },

    listingCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    status: { type: String, enum: ["approved", "pending"], default: "pending" },
    requestedBy: { type: Types.ObjectId, ref: "Dealer" }, // set when a dealer requested it
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Section 5 indexes.
localitySchema.index({ cityId: 1, slug: 1 }, { unique: true }); // scoped uniqueness
localitySchema.index({ cityId: 1, isActive: 1 }); // active-locality lookups

export type LocalityDoc = InferSchemaType<typeof localitySchema>;

export const Locality: Model<LocalityDoc> =
  (models.Locality as Model<LocalityDoc>) ??
  model<LocalityDoc>("Locality", localitySchema);

export default Locality;
