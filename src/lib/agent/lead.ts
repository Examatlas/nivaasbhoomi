import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { Conversation } from "@/lib/db/models/Conversation";
import { findDuplicateLead } from "@/lib/leads/dedupe";
import { isSeedListing, SEED_CONTACT_BLOCKED_MESSAGE } from "@/lib/listings/seed";
import { sendLeadAssigned, logAudit } from "@/lib/leads/assign";
import { agentLeadsCountTowardQuota } from "@/lib/config/agent";

/**
 * Create a lead from a dealer's OWN Zenith WhatsApp agent (source
 * "whatsapp_agent"). It is assigned DIRECTLY to that dealer — routing/rotation
 * is bypassed and it's pinned (no SLA auto-reassign), because it's the dealer's
 * own traffic. Reuses the SHARED dedup rule and the seed-contact block. Counts
 * toward the monthly quota only when AGENT_LEADS_COUNT_TOWARD_QUOTA is true.
 */
export interface AgentLeadInput {
  dealerId: string; // from the authenticated key — never client input
  name?: string;
  phone: string; // normalized "91XXXXXXXXXX"
  listingId?: string | null;
  message?: string;
  intent?: string;
}

export type AgentLeadResult =
  | { ok: true; leadId: string; deduped: boolean; assignedNow: boolean }
  | { ok: false; code: "SEED_BLOCKED"; message: string };

export async function createAgentLead(input: AgentLeadInput): Promise<AgentLeadResult> {
  await connectDB();
  const dealerOid = new mongoose.Types.ObjectId(input.dealerId);

  // Seed listing → blocked (existing server rule): never create a lead on a seed.
  if (input.listingId && (await isSeedListing(input.listingId))) {
    return { ok: false, code: "SEED_BLOCKED", message: SEED_CONTACT_BLOCKED_MESSAGE };
  }

  // Attach the listing ONLY if it is THIS dealer's approved, non-seed listing.
  // A cross-dealer id is ignored (the lead stays a dealer-level lead) — never a
  // route to another dealer's data.
  let validListingId: string | null = null;
  if (input.listingId && mongoose.Types.ObjectId.isValid(input.listingId)) {
    const l = await Listing.findOne(
      {
        _id: new mongoose.Types.ObjectId(input.listingId),
        dealerId: dealerOid,
        status: "approved",
        isSeed: { $ne: true },
      },
      { _id: 1 },
    ).lean();
    if (l) validListingId = input.listingId;
  }

  // Shared dedup (24h): listing lead → phone + listingId; else phone + dealerId.
  const dup = validListingId
    ? await findDuplicateLead({ phone: input.phone, listingId: validListingId })
    : await findDuplicateLead({ phone: input.phone, dealerId: input.dealerId });
  if (dup) return { ok: true, leadId: dup, deduped: true, assignedNow: false };

  const now = new Date();
  const note =
    [input.intent?.trim(), input.message?.trim()].filter(Boolean).join(" — ") ||
    "Enquiry via your WhatsApp agent.";
  await Conversation.findOneAndUpdate(
    { phone: input.phone },
    {
      $push: { messages: { direction: "in", type: "enquiry", body: note, timestamp: now } },
      $set: { lastMessageAt: now, windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    },
    { upsert: true },
  );

  const lead = await Lead.create({
    phone: input.phone,
    name: input.name?.trim() || undefined,
    source: "whatsapp_agent",
    ...(validListingId ? { listingId: new mongoose.Types.ObjectId(validListingId) } : {}),
    status: "new",
  });
  const leadId = String(lead._id);
  await Conversation.updateOne({ phone: input.phone }, { $set: { leadId } });

  // Assign to the key's dealer — pinned (slaDeadline null → never auto-reassigned).
  const claimed = await Lead.findOneAndUpdate(
    { _id: lead._id, assignedDealerId: null },
    {
      $set: {
        assignedDealerId: dealerOid,
        assignedAt: now,
        isLocked: true,
        status: "assigned",
        viewedAt: null,
        slaDeadline: null,
      },
    },
    { new: true },
  );

  if (claimed) {
    const countQuota = agentLeadsCountTowardQuota();
    await Dealer.updateOne(
      { _id: dealerOid },
      {
        // Quota counter (leadsUsedThisMonth) only when the flag says so; the
        // lifetime totalLeadsReceived always counts a real received lead.
        $inc: countQuota
          ? { leadsUsedThisMonth: 1, totalLeadsReceived: 1 }
          : { totalLeadsReceived: 1 },
        $set: { lastAssignedAt: now },
      },
    );
    if (validListingId) {
      await Listing.updateOne(
        { _id: new mongoose.Types.ObjectId(validListingId) },
        { $inc: { leadCount: 1 } },
      );
    }
    await sendLeadAssigned(input.dealerId, claimed as never);
    await logAudit({
      action: "lead.auto-assign",
      actor: { actorType: "system", actorId: "agent-api" },
      leadId,
      dealerId: input.dealerId,
      reason: "whatsapp agent (dealer's own)",
      metadata: { countQuota },
    });
  }

  return { ok: true, leadId, deduped: false, assignedNow: Boolean(claimed) };
}
