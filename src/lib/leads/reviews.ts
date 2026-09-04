import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { logAudit } from "@/lib/leads/assign";

/**
 * Reviews + ratings (DEV-SPEC.txt Section 13).
 *
 *  - Only a buyer whose lead is 'site-visit-done' may review (blocks fake
 *    reviews), and only ONCE per lead.
 *  - The review is stored on the Lead; the dealer's rating/ratingCount are the
 *    aggregate of all their reviewed leads.
 *  - Auto-pause: rating < 3.0 with 5+ ratings pauses the dealer (no new leads)
 *    and alerts the admin (an audit record).
 */

export const AUTO_PAUSE_MIN_RATINGS = 5;
export const AUTO_PAUSE_RATING_THRESHOLD = 3.0;

export interface ReviewContext {
  leadId: string;
  dealerName: string;
  reviewable: boolean;
  alreadyReviewed: boolean;
  reason?: string;
}

/** What the buyer-facing review page needs, or null if the lead doesn't exist. */
export async function getReviewContext(leadId: string): Promise<ReviewContext | null> {
  if (!mongoose.Types.ObjectId.isValid(leadId)) return null;
  await connectDB();
  const lead = await Lead.findById(leadId, {
    status: 1,
    reviewedAt: 1,
    assignedDealerId: 1,
  }).lean();
  if (!lead) return null;

  const dealer = lead.assignedDealerId
    ? await Dealer.findById(lead.assignedDealerId, { businessName: 1 }).lean()
    : null;

  const alreadyReviewed = Boolean(lead.reviewedAt);
  const eligible = lead.status === "site-visit-done";
  return {
    leadId,
    dealerName: dealer?.businessName ?? "the dealer",
    reviewable: eligible && !alreadyReviewed,
    alreadyReviewed,
    reason: !eligible
      ? "This lead is not eligible for a review yet (a completed site visit is required)."
      : alreadyReviewed
        ? "This lead has already been reviewed."
        : undefined,
  };
}

export type SubmitReviewResult =
  | { ok: true; dealerRating: number; dealerRatingCount: number; paused: boolean }
  | { ok: false; error: string };

export async function submitReview(
  leadId: string,
  rating: number,
  comment?: string,
): Promise<SubmitReviewResult> {
  if (!mongoose.Types.ObjectId.isValid(leadId)) return { ok: false, error: "Invalid link." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be a whole number from 1 to 5." };
  }
  await connectDB();

  // Atomic guard: only claim a site-visit-done, not-yet-reviewed lead. This is
  // the anti-fake-review lock AND the one-per-lead lock, in one write.
  const lead = await Lead.findOneAndUpdate(
    { _id: leadId, status: "site-visit-done", reviewedAt: null },
    {
      $set: {
        reviewRating: rating,
        reviewComment: comment?.trim() || undefined,
        reviewedAt: new Date(),
      },
    },
    { new: true, projection: { assignedDealerId: 1 } },
  );
  if (!lead) {
    return {
      ok: false,
      error: "This review link is not valid, already used, or the visit isn't complete.",
    };
  }
  if (!lead.assignedDealerId) {
    return { ok: false, error: "This lead has no dealer to review." };
  }

  const dealerId = String(lead.assignedDealerId);

  // Recompute the dealer's aggregate rating from all reviewed leads.
  const [agg] = await Lead.aggregate<{ avg: number; count: number }>([
    {
      $match: {
        assignedDealerId: new mongoose.Types.ObjectId(dealerId),
        reviewRating: { $type: "number" },
      },
    },
    { $group: { _id: null, avg: { $avg: "$reviewRating" }, count: { $sum: 1 } } },
  ]);
  const dealerRating = agg ? Math.round(agg.avg * 10) / 10 : rating;
  const dealerRatingCount = agg?.count ?? 1;

  const paused =
    dealerRating < AUTO_PAUSE_RATING_THRESHOLD &&
    dealerRatingCount >= AUTO_PAUSE_MIN_RATINGS;

  await Dealer.updateOne(
    { _id: dealerId },
    {
      $set: {
        rating: dealerRating,
        ratingCount: dealerRatingCount,
        ...(paused ? { status: "paused" } : {}),
      },
    },
  );

  if (paused) {
    // Admin alert (audit trail; the admin queue/dashboard surfaces paused dealers).
    await logAudit({
      action: "lead.status-change",
      actor: { actorType: "system", actorId: "rating" },
      leadId,
      dealerId,
      reason: `dealer auto-paused: rating ${dealerRating} over ${dealerRatingCount} reviews (< ${AUTO_PAUSE_RATING_THRESHOLD})`,
    });
  }

  return { ok: true, dealerRating, dealerRatingCount, paused };
}
