import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { sendBusinessTemplate } from "@/lib/whatsapp/send";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Lead lifecycle side effects (DEV-SPEC.txt Section 13). Runs after a lead's
 * status changes:
 *   - contacted:        record firstResponseMinutes (buyer's first message ->
 *                       dealer's first response) and refresh the dealer's
 *                       avgResponseMinutes trust signal from REAL data.
 *   - site-visit-done:  send the buyer a review_request with a one-time review
 *                       link (only such buyers may review - Section 13).
 * Best-effort: never throws to the caller.
 *
 * Decision: "first response" is measured as the dealer's first action on the
 * lead - marking it 'contacted' - timed from the lead's creation (the buyer's
 * first qualified message). Our WhatsApp thread is buyer<->portal; the dealer
 * contacts the buyer directly, so the status change is the real, dealer-
 * attributable signal (rather than the AI's instant auto-reply).
 */
export async function onLeadStatusChanged(
  leadId: string,
  newStatus: string,
): Promise<void> {
  try {
    if (newStatus === "contacted") {
      await recordFirstResponse(leadId);
    } else if (newStatus === "site-visit-done") {
      await sendReviewRequest(leadId);
    }
  } catch {
    /* side effects are best-effort */
  }
}

async function recordFirstResponse(leadId: string): Promise<void> {
  await connectDB();
  const lead = await Lead.findById(leadId, {
    createdAt: 1,
    firstResponseMinutes: 1,
    assignedDealerId: 1,
  }).lean();
  if (!lead || !lead.assignedDealerId) return;
  // Only record the FIRST response - never overwrite it.
  if (typeof lead.firstResponseMinutes === "number") return;

  const created = lead.createdAt ? new Date(lead.createdAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  await Lead.updateOne({ _id: leadId }, { $set: { firstResponseMinutes: minutes } });

  await recomputeAvgResponse(String(lead.assignedDealerId));
}

/** Recompute a dealer's avgResponseMinutes from all their recorded leads. */
export async function recomputeAvgResponse(dealerId: string): Promise<void> {
  await connectDB();
  const [agg] = await Lead.aggregate<{ avg: number }>([
    {
      $match: {
        assignedDealerId: new mongoose.Types.ObjectId(dealerId),
        firstResponseMinutes: { $type: "number" },
      },
    },
    { $group: { _id: null, avg: { $avg: "$firstResponseMinutes" } } },
  ]);
  if (agg) {
    await Dealer.updateOne(
      { _id: dealerId },
      { $set: { avgResponseMinutes: Math.round(agg.avg) } },
    );
  }
}

async function sendReviewRequest(leadId: string): Promise<void> {
  await connectDB();
  const lead = await Lead.findById(leadId, {
    phone: 1,
    assignedDealerId: 1,
    reviewedAt: 1,
  }).lean();
  if (!lead?.phone || !lead.assignedDealerId || lead.reviewedAt) return;

  const dealer = await Dealer.findById(lead.assignedDealerId, { businessName: 1 }).lean();
  await sendBusinessTemplate(lead.phone, "review_request", {
    dealerName: dealer?.businessName ?? "the dealer",
    reviewUrl: absoluteUrl(`/review/${leadId}`),
  });
}
