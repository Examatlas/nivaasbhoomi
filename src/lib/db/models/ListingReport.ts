import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * ListingReport — a public "report this listing" submission. Anyone browsing can
 * flag a listing (fake, already sold, wrong price/photos, other); an admin
 * triages the queue at /admin/reports.
 *
 * Anti-abuse: the submit endpoint rate-limits to 3 reports/hour/IP by counting
 * recent rows for the same `ip` — so no separate log collection is needed and
 * the reports themselves stay for the admin to review.
 */
export const REPORT_REASONS = [
  "fake-listing",
  "already-sold",
  "wrong-price",
  "wrong-photos",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

const listingReportSchema = new Schema(
  {
    listingId: { type: Types.ObjectId, ref: "Listing", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    ip: { type: String }, // for rate limiting only
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
    },
  },
  { timestamps: true },
);

// Admin queue: open reports newest first.
listingReportSchema.index({ status: 1, createdAt: -1 });
// Rate-limit lookups: recent reports from one IP.
listingReportSchema.index({ ip: 1, createdAt: -1 });
// All reports against one listing (admin drill-down).
listingReportSchema.index({ listingId: 1 });

export type ListingReportDoc = InferSchemaType<typeof listingReportSchema>;

export const ListingReport: Model<ListingReportDoc> =
  (models.ListingReport as Model<ListingReportDoc>) ??
  model<ListingReportDoc>("ListingReport", listingReportSchema);

export default ListingReport;
