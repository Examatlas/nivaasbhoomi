import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Conversation } from "@/lib/db/models/Conversation";
import { Listing } from "@/lib/db/models/Listing";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { findDuplicateLead } from "@/lib/leads/dedupe";
import { routeLead, routeLeadToDealer } from "@/lib/leads/routing";

/**
 * Direct on-site enquiries (no WhatsApp AI). Every path here dedups through the
 * SHARED rule in lib/leads/dedupe (phone + dealer + listing, 24h) before it
 * creates a lead, then routes it through the SAME lock/quota/rotation engine.
 */

export interface EnquiryInput {
  name: string;
  phone: string; // already normalised (91XXXXXXXXXX)
  listingId?: string | null;
  message?: string;
  /** True when the buyer arrived via a property-alert link (Phase 3). */
  fromAlert?: boolean;
}

export interface EnquiryResult {
  ok: true;
  leadId: string;
  assignedNow: boolean;
  decision: string;
}

async function logConversation(phone: string, body: string, now: Date): Promise<void> {
  await Conversation.findOneAndUpdate(
    { phone },
    {
      $push: { messages: { direction: "in", type: "enquiry", body, timestamp: now } },
      $set: {
        lastMessageAt: now,
        windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true },
  );
}

/** Buyer taps "Contact Us" on a listing → lead to that listing's owner. */
export async function createEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  await connectDB();

  const listingId =
    input.listingId && mongoose.Types.ObjectId.isValid(input.listingId) ? input.listingId : null;

  let validListingId: string | null = null;
  if (listingId) {
    const listing = await Listing.findById(listingId, { status: 1 }).lean();
    if (listing && listing.status === "approved") validListingId = listingId;
  }
  if (!validListingId) return { ok: true, leadId: "", assignedNow: false, decision: "skip" };

  // Shared dedup: same buyer + same listing (= same dealer) within 24h.
  const dup = await findDuplicateLead({ phone: input.phone, listingId: validListingId });
  if (dup) return { ok: true, leadId: dup, assignedNow: false, decision: "deduped" };

  const now = new Date();
  await logConversation(input.phone, input.message?.trim() || "Enquired about a listing.", now);

  const lead = await Lead.create({
    phone: input.phone,
    name: input.name,
    source: "listing",
    listingId: new mongoose.Types.ObjectId(validListingId),
    status: "new",
    ...(input.fromAlert ? { fromAlert: true } : {}),
  });
  const leadId = String(lead._id);
  await Conversation.updateOne({ phone: input.phone }, { $set: { leadId } });

  const r = await routeLead(leadId);
  return { ok: true, leadId, assignedNow: Boolean(r.assignedNow), decision: r.decision };
}

export interface AgentProfileEnquiryInput {
  dealerId: string;
  name: string;
  phone: string; // normalised (91XXXXXXXXXX)
  message?: string;
  fromAlert?: boolean;
}

/** Buyer contacts a dealer directly from their public /agent profile. */
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

  // Shared dedup: same buyer + same dealer within 24h (agent profile has no listing).
  const dup = await findDuplicateLead({ phone: input.phone, dealerId: input.dealerId });
  if (dup) return { ok: true, leadId: dup, assignedNow: false, decision: "deduped" };

  const now = new Date();
  await logConversation(
    input.phone,
    input.message?.trim() || "Contacted via your NivaasBhoomi profile.",
    now,
  );

  const lead = await Lead.create({
    phone: input.phone,
    name: input.name,
    source: "agent_profile",
    status: "new",
    ...(input.fromAlert ? { fromAlert: true } : {}),
  });
  const leadId = String(lead._id);
  await Conversation.updateOne({ phone: input.phone }, { $set: { leadId } });

  const r = await routeLeadToDealer(leadId, input.dealerId);
  return { ok: true, leadId, assignedNow: Boolean(r.assignedNow), decision: r.decision };
}
