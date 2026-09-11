import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import {
  computePricePerSqft,
  computeExpiresAt,
  resolveListingSlug,
} from "@/lib/listings/derive";

/**
 * Listing (DEV-SPEC.txt Section 4).
 *
 * A listing is `draft` while the dealer's multi-step form is incomplete
 * (Section 13), so fields the spec marks required are only enforced ON SUBMIT
 * (status !== 'draft'). dealerId/purpose/propertyType are the minimum identity
 * and are always required.
 *
 * Derived on save (pre-validate, so the values exist before validation):
 *   - lastRefreshedAt / expiresAt on creation (expiresAt = +30 days)
 *   - pricePerSqft for sale listings
 *   - slug, generated exactly ONCE and never regenerated (URL stability, S6)
 *   - location GeoJSON point mirrored from lat/lng for the 2dsphere index
 *
 * PRIVACY (Section 13): fullAddress is NEVER exposed publicly - enforced by the
 * API projection layer.
 */

// A listing leaves draft on submit; these fields are required only then.
function requiredOnSubmit(this: unknown): boolean {
  return (this as { status?: string }).status !== "draft";
}

const photoSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    width: { type: Number },
    height: { type: Number },
    // Dealer/admin-only quality tag (shorter side < 800px). Never shown to buyers.
    isLowResolution: { type: Boolean },
  },
  { _id: false },
);

const listingSchema = new Schema(
  {
    // ownership
    dealerId: { type: Types.ObjectId, ref: "Dealer", required: true },

    // basic
    purpose: { type: String, enum: ["sale", "rent"], required: true },
    propertyType: {
      type: String,
      enum: [
        "flat",
        "independent-house",
        "villa",
        "plot",
        "commercial-shop",
        "office",
        "pg",
        "warehouse",
        "farmhouse",
      ],
      required: true,
    },
    title: {
      type: String,
      required: [requiredOnSubmit, "Title is required"],
      trim: true,
    },
    // required + minlength 100 enforced on submit via the pre-validate hook so
    // drafts can be saved incomplete.
    description: { type: String, trim: true },

    // location
    stateId: {
      type: Types.ObjectId,
      ref: "State",
      required: [requiredOnSubmit, "State is required"],
    },
    cityId: {
      type: Types.ObjectId,
      ref: "City",
      required: [requiredOnSubmit, "City is required"],
    },
    localityId: {
      type: Types.ObjectId,
      ref: "Locality",
      required: [requiredOnSubmit, "Locality is required"],
    },
    subLocality: { type: String },
    projectName: { type: String },
    landmark: { type: String },
    fullAddress: { type: String }, // NEVER exposed publicly
    lat: { type: Number, required: [requiredOnSubmit, "Latitude is required"] },
    lng: { type: Number, required: [requiredOnSubmit, "Longitude is required"] },
    pincode: { type: String },
    // GeoJSON mirror of lat/lng for the 2dsphere index (maintained in the hook).
    // No `default` on type: a draft without lat/lng must have NO location subdoc
    // at all, otherwise a coordinate-less { type: "Point" } breaks the 2dsphere
    // index ("Point must be an array"). The hook sets a full Point when coords
    // exist and clears it otherwise.
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    // details
    bhk: { type: String }, // '1rk','1','2','3','4','5plus'
    bathrooms: { type: Number },
    balconies: { type: Number },
    carpetArea: { type: Number },
    builtUpArea: { type: Number },
    superBuiltUpArea: { type: Number },
    plotArea: { type: Number },
    floor: { type: Number },
    totalFloors: { type: Number },
    facing: { type: String },
    ageOfProperty: { type: String },

    // furnishing
    furnishing: { type: String, enum: ["furnished", "semi-furnished", "unfurnished"] },
    furnishingDetails: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    parking: { type: String },
    waterSource: { type: [String], default: [] },

    // price - SALE
    expectedPrice: { type: Number },
    pricePerSqft: { type: Number }, // auto
    priceNegotiable: { type: Boolean },
    bookingAmount: { type: Number },

    // price - RENT
    monthlyRent: { type: Number },
    securityDeposit: { type: Number },
    rentNegotiable: { type: Boolean },
    preferredTenant: { type: [String], default: [] },
    availableFrom: { type: Date },
    minLeasePeriod: { type: String },

    // common price
    maintenanceCharge: { type: Number },
    brokerage: { type: String }, // PUBLIC - transparency

    // legal
    possessionStatus: { type: String },
    possessionDate: { type: Date },
    ownershipType: { type: String },
    reraNumber: { type: String },
    reraStateId: { type: Types.ObjectId, ref: "State" },
    approvedBy: { type: [String], default: [] },
    // Dealer's own declaration that a plot falls under the Chotanagpur Tenancy
    // Act. Plots only; NOT admin-verified — see the public "CNT" tag.
    isCntLand: { type: Boolean, default: false },

    // media
    photos: { type: [photoSchema], default: [] },
    coverPhotoIndex: { type: Number, default: 0 },
    video: {
      url: { type: String },
      publicId: { type: String },
      duration: { type: Number },
    },
    floorPlan: {
      url: { type: String },
      publicId: { type: String },
    },

    // trust badges
    badges: {
      documentsChecked: { type: Boolean, default: false },
      photosVerified: { type: Boolean, default: false },
      siteVisited: { type: Boolean, default: false },
    },

    // system
    slug: {
      type: String,
      required: [requiredOnSubmit, "Slug is required"],
      lowercase: true,
      trim: true,
    },
    // Old slugs kept forever so an admin slug change 301-redirects (indexed
    // Google URLs / WhatsApp-shared links must never 404). Sitemap + canonical
    // only ever use the current `slug`.
    previousSlugs: { type: [String], default: [] },
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "pending-location",
        "approved",
        "rejected",
        "expired",
        "deleted",
      ],
      default: "draft",
    },
    rejectionReason: { type: String },
    lastRefreshedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    // When the day-25 expiry warning was last sent, so the cron warns once per
    // 30-day window (a refresh resets lastRefreshedAt, re-arming a new warning).
    expiryWarnedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
    leadCount: { type: Number, default: 0 },

    // ---- Seed (display-only) listings ----
    // A temporary placeholder listing so a fresh city/site doesn't look empty.
    // Display-only: NO contact/enquiry (blocked server-side too), never counted
    // toward city/locality activation or rate data, and noindexed. Removed as
    // real dealers arrive, or auto-archived after seedExpiresAt.
    isSeed: { type: Boolean, default: false },
    seedExpiresAt: { type: Date, default: null },

    // SEO
    metaTitle: { type: String },
    metaDescription: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

/**
 * Derive values before validation runs, so the required slug/lastRefreshedAt/
 * expiresAt exist by the time validation checks them.
 */
listingSchema.pre("validate", async function () {
  // 1. Timestamps on creation. The 30-day clock starts now; the refresh
  //    endpoint resets both fields later.
  if (this.isNew) {
    if (!this.lastRefreshedAt) this.lastRefreshedAt = new Date();
    if (!this.expiresAt) this.expiresAt = computeExpiresAt(this.lastRefreshedAt);
  }

  // 2. pricePerSqft (sale only).
  const pps = computePricePerSqft(
    this.purpose,
    this.expectedPrice,
    this.carpetArea,
    this.builtUpArea,
  );
  if (pps !== undefined) this.pricePerSqft = pps;

  // 3. GeoJSON point for the 2dsphere index. Clear it entirely when there are
  //    no coordinates yet (draft), so no invalid coordinate-less Point is stored.
  if (typeof this.lat === "number" && typeof this.lng === "number") {
    this.location = { type: "Point", coordinates: [this.lng, this.lat] };
  } else {
    this.set("location", undefined);
  }

  // 4. Slug - generated exactly once, never regenerated. Needs a resolvable
  //    city + locality slug and a price, which a non-draft listing always has.
  if (!this.slug && this.status !== "draft" && this.cityId && this.localityId) {
    const price = this.purpose === "rent" ? this.monthlyRent : this.expectedPrice;
    if (this.purpose && this.propertyType && price) {
      const [city, locality] = await Promise.all([
        City.findById(this.cityId, { slug: 1 }).lean(),
        Locality.findById(this.localityId, { slug: 1 }).lean(),
      ]);
      if (city?.slug && locality?.slug) {
        this.slug = resolveListingSlug(this.slug, {
          bhk: this.propertyType === "plot" ? undefined : (this.bhk ?? undefined),
          propertyType: this.propertyType,
          localitySlug: locality.slug,
          citySlug: city.slug,
          purpose: this.purpose,
          price,
        });
      }
    }
  }

  // 5. Business validations (Section 13).
  //    Cross-field / min-length rules that field options can't express.
  if (this.status !== "draft") {
    if (!this.description || this.description.trim().length < 100) {
      this.invalidate(
        "description",
        "Description must be at least 100 characters.",
        this.description,
      );
    }
    if (!this.photos || this.photos.length < 1) {
      this.invalidate("photos", "Add at least 1 photo.", this.photos);
    }
    if (this.purpose === "sale" && !this.expectedPrice) {
      this.invalidate("expectedPrice", "expectedPrice is required for a sale listing.");
    }
    if (this.purpose === "rent" && !this.monthlyRent) {
      this.invalidate("monthlyRent", "monthlyRent is required for a rent listing.");
    }
    if (this.possessionStatus === "under-construction") {
      if (!this.reraNumber) {
        this.invalidate("reraNumber", "reraNumber is required for under-construction.");
      }
      if (!this.reraStateId) {
        this.invalidate("reraStateId", "reraStateId is required for under-construction.");
      }
    }
  }

  // Plots never have BHK / bathrooms / floor - a structural rule, always on.
  if (this.propertyType === "plot") {
    if (this.bhk) this.invalidate("bhk", "A plot cannot have a BHK value.", this.bhk);
    if (this.bathrooms != null) {
      this.invalidate("bathrooms", "A plot cannot have bathrooms.", this.bathrooms);
    }
    if (this.floor != null) {
      this.invalidate("floor", "A plot cannot have a floor.", this.floor);
    }
  }
});

// Section 5 indexes.
listingSchema.index(
  { cityId: 1, localityId: 1, purpose: 1, propertyType: 1, status: 1 }, // main query
);
// Unique slug, but only for listings that actually have one (drafts have none).
listingSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } },
);
// Old-slug → current-slug 301 lookups (admin slug edits).
listingSchema.index({ previousSlugs: 1 });
listingSchema.index({ dealerId: 1, status: 1 });
listingSchema.index({ status: 1, expiresAt: 1 }); // expiry cron
listingSchema.index({ cityId: 1, status: 1, createdAt: -1 }); // city page
listingSchema.index({ localityId: 1, status: 1, expectedPrice: 1 });
listingSchema.index({ location: "2dsphere" }); // future map search (from lat/lng)
// Seed admin filter (by city) + the expire-seed cron (isSeed + seedExpiresAt).
listingSchema.index({ isSeed: 1, cityId: 1 });
listingSchema.index({ isSeed: 1, seedExpiresAt: 1 });

export type ListingDoc = InferSchemaType<typeof listingSchema>;

export const Listing: Model<ListingDoc> =
  (models.Listing as Model<ListingDoc>) ?? model<ListingDoc>("Listing", listingSchema);

export default Listing;
