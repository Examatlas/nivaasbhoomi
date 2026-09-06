import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { Listing } from "@/lib/db/models/Listing";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { upsertLead } from "@/lib/leads/upsert";
import { routeLead, routeLeadToDealer } from "@/lib/leads/routing";

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

export interface AgentProfileEnquiryInput {
  dealerId: string;
  name: string;
  phone: string; // normalised (91XXXXXXXXXX)
  message?: string;
}

/**
 * A buyer contacting a dealer DIRECTLY from their public /agent profile. Unlike a
 * listing enquiry, this creates a DEDICATED lead for the chosen dealer (source
 * "agent_profile") and assigns it straight to them — no coverage rotation, since
 * the buyer picked this dealer. It goes through routeLeadToDealer, so it consumes
 * quota, is locked/exclusive, and falls to the admin over-quota queue when the
 * dealer is over quota — identical rules to every other lead.
 *
 * Deduped: if the buyer already has an open lead with this dealer, we return it
 * instead of creating a duplicate.
 */
export async function createAgentProfileEnquiry(
  input: AgentProfileEnquiryInput,
): Promise<EnquiryResult> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(input.dealerId)) {
    return { ok: true, leadId: "", assignedNow: false, decision: "skip" };
  }
  const dealer = await Dealer.findById(input.dealerId, { status: 1 }).lean();
  if (!dealer || dealer.status === "banned") {
    return { ok: true, leadId: "", assignedNow: false, decision: "skip" };
  }

  const dealerObjId = new mongoose.Types.ObjectId(input.dealerId);

  // Dedup: an open lead already with this dealer for this phone.
  const existing = await Lead.findOne(
    {
      phone: input.phone,
      assignedDealerId: dealerObjId,
      status: { $nin: ["converted", "lost"] },
    },
    { _id: 1 },
  ).lean();
  if (existing) {
    return {
      ok: true,
      leadId: String(existing._id),
      assignedNow: false,
      decision: "already-assigned",
    };
  }

  const now = new Date();
  const body = input.message?.trim() || "Contacted via your NivaasBhoomi profile.";

  await Conversation.findOneAndUpdate(
    { phone: input.phone },
    {
      $push: { messages: { direction: "in", type: "enquiry", body, timestamp: now } },
      $set: {
        lastMessageAt: now,
        windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true },
  );

  // A dedicated lead for THIS dealer (never reuse an unrelated open lead).
  const lead = await Lead.create({
    phone: input.phone,
    name: input.name,
    source: "agent_profile",
    status: "new",
  });
  const leadId = String(lead._id);
  await Conversation.updateOne({ phone: input.phone }, { $set: { leadId } });

  const r = await routeLeadToDealer(leadId, input.dealerId);
  return {
    ok: true,
    leadId,
    assignedNow: Boolean(r.assignedNow),
    decision: r.decision,
  };
}
