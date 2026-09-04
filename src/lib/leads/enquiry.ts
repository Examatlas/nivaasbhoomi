import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { Listing } from "@/lib/db/models/Listing";
import { upsertLead } from "@/lib/leads/upsert";
import { routeLead } from "@/lib/leads/routing";

/**
 * Direct on-site enquiry (launch flow, no WhatsApp). A buyer submits a simple
 * form (name + phone + optional message) on a listing; we create the Lead in our
 * DB and route it to the listing's owner (or, for a generic enquiry, the best
 * covering dealer), so it lands in that dealer's My Leads and the admin views.
 * The dealer then contacts the buyer directly.
 *
 * Reuses the SAME upsert + routeLead pipeline as everything else, so routing,
 * quota, exclusivity and dealer notification behave identically.
 */

export interface EnquiryInput {
  name: string;
  phone: string; // already normalised (91XXXXXXXXXX)
  listingId?: string | null;
  message?: string;
}

export interface EnquiryResult {
  ok: true;
  leadId: string;
  assignedNow: boolean;
  decision: string;
}

export async function createEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  await connectDB();

  const listingId =
    input.listingId && mongoose.Types.ObjectId.isValid(input.listingId)
      ? input.listingId
      : null;

  // Only accept a listing enquiry against a real, live listing.
  let validListingId: string | null = null;
  if (listingId) {
    const listing = await Listing.findById(listingId, { status: 1 }).lean();
    if (listing && listing.status === "approved") validListingId = listingId;
  }

  const now = new Date();
  const body =
    input.message?.trim() ||
    (validListingId ? "Enquired about a listing." : "General property enquiry.");

  // Log the enquiry as an inbound message so the admin conversation viewer shows
  // it, and refresh the 24h window field for consistency.
  const conv = await Conversation.findOneAndUpdate(
    { phone: input.phone },
    {
      $push: {
        messages: {
          direction: "in",
          type: "enquiry",
          body,
          timestamp: now,
        },
      },
      $set: {
        lastMessageAt: now,
        windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true, new: true },
  );

  const leadId = await upsertLead({
    phone: input.phone,
    profileName: input.name,
    listingId: validListingId,
    convLeadId: conv.leadId ? String(conv.leadId) : null,
    extracted: { name: input.name },
    // A form enquiry is a real lead but not AI-qualified.
    isQualified: false,
  });

  if (leadId && String(conv.leadId ?? "") !== leadId) {
    await Conversation.updateOne({ phone: input.phone }, { $set: { leadId } });
  }

  // Route it to a dealer (listing owner, or coverage routing) exactly like any
  // other lead. Unmatched/over-quota enquiries fall to the admin queue.
  const r = leadId
    ? await routeLead(leadId)
    : { decision: "skip", assignedNow: false };

  return {
    ok: true,
    leadId: leadId ?? "",
    assignedNow: Boolean(r.assignedNow),
    decision: r.decision,
  };
}
