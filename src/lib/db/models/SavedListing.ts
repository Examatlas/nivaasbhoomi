import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * SavedListing — a buyer's shortlisted property (account-based, not localStorage).
 * One row per (user, listing). The unique compound index makes "save" idempotent:
 * a re-save can't create a duplicate, so the toggle is safe under double-clicks.
 *
 * Buyer-scoped and private: a row is only ever read/written for the owning
 * userId taken from the verified session — never from anything the client sends.
 */
const savedListingSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    listingId: { type: Types.ObjectId, ref: "Listing", required: true },
  },
  { timestamps: true },
);

// One save per (user, listing) — enforces idempotency.
savedListingSchema.index({ userId: 1, listingId: 1 }, { unique: true });
// The /saved page lists a buyer's saves, newest first.
savedListingSchema.index({ userId: 1, createdAt: -1 });

export type SavedListingDoc = InferSchemaType<typeof savedListingSchema>;

export const SavedListing: Model<SavedListingDoc> =
  (models.SavedListing as Model<SavedListingDoc>) ??
  model<SavedListingDoc>("SavedListing", savedListingSchema);

export default SavedListing;
