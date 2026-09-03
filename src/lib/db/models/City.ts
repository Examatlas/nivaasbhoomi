import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * City (DEV-SPEC.txt Section 4).
 *
 * slug is GLOBALLY unique - collisions across states are resolved at generation
 * time by generateCitySlug (Section 6), so by the time a value reaches this
 * schema it is already disambiguated ("aurangabad" vs "aurangabad-bihar").
 *
 * isActive is the launch switch: a city only appears on the public site once an
 * admin activates it, and Section 13 forbids activation until it clears the
 * 25-listings / 5-verified-dealers / 3-active-localities guard.
 */
const faqSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const citySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    stateId: { type: Types.ObjectId, ref: "State", required: true },
    tier: { type: Number, enum: [1, 2, 3], default: 3 },
    isActive: { type: Boolean, default: false },

    lat: { type: Number },
    lng: { type: Number },

    // SEO content (filled by admin / content pipeline, not at seed time)
    introText: { type: String }, // 200+ words
    metaTitle: { type: String },
    metaDescription: { type: String },
    faq: { type: [faqSchema], default: [] },

    // auto-maintained counters (kept in sync by listing/dealer lifecycle)
    listingCount: { type: Number, default: 0 },
    dealerCount: { type: Number, default: 0 },
    localityCount: { type: Number, default: 0 },

    popularLocalities: { type: [{ type: Types.ObjectId, ref: "Locality" }], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Section 5 indexes. { slug:1 } unique comes from the field definition; add the
// state+active index used by the cascading city dropdown and city listings.
citySchema.index({ stateId: 1, isActive: 1 });

export type CityDoc = InferSchemaType<typeof citySchema>;

export const City: Model<CityDoc> =
  (models.City as Model<CityDoc>) ?? model<CityDoc>("City", citySchema);

export default City;
