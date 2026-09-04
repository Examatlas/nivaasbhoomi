import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { Locality } from "@/lib/db/models/Locality";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { sendTemplate } from "@/lib/whatsapp/client";

/**
 * Shared lead-assignment side effects + audit (DEV-SPEC.txt Sections 12, 16).
 *
 * This is the single implementation of the `assign()` side-effects the spec
 * describes, reused by the automatic router AND by the admin manual-assign and
 * admin override-reassign flows - so every path locks the lead, moves the
 * counters identically, fires the lead_assigned template, and writes an audit
 * record. Nothing here ever throws to the caller from the notification/audit
 * steps; those are best-effort.
 */

export interface AuditActor {
  actorType: "system" | "admin" | "dealer";
  actorId?: string;
}

interface LeadForTemplate {
  name?: string | null;
  waProfileName?: string | null;
  phone: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  timeline?: string | null;
  localityId?: unknown;
}

export function formatBudget(min?: number | null, max?: number | null): string {
  const unit = (n: number) =>
    n >= 1e7 ? `${(n / 1e7).toFixed(2).replace(/\.00$/, "")} Cr` : `${Math.round(n / 1e5)} L`;
  if (min && max) return `Rs ${unit(min)} - ${unit(max)}`;
  if (max) return `up to Rs ${unit(max)}`;
  if (min) return `Rs ${unit(min)}+`;
  return "not specified";
}

/** Fire the lead_assigned template to a dealer with the buyer's details. */
export async function sendLeadAssigned(
  dealerId: string,
  lead: LeadForTemplate,
): Promise<boolean> {
  const dealer = await Dealer.findById(dealerId, { phone: 1 }).lean();
  if (!dealer?.phone) return false;

  let locality = "your area";
  if (lead.localityId) {
    const loc = await Locality.findById(lead.localityId, { name: 1 }).lean();
    if (loc?.name) locality = loc.name;
  }

  const res = await sendTemplate(dealer.phone, "lead_assigned", {
    buyerName: lead.name || lead.waProfileName || "A buyer",
    buyerPhone: `+${lead.phone}`,
    budget: formatBudget(lead.budgetMin, lead.budgetMax),
    locality,
    timeline: lead.timeline || "not specified",
  });
  return res.delivered;
}

/** Append an audit record (best-effort; never throws). */
export async function logAudit(entry: {
  action:
    | "lead.auto-assign"
    | "lead.admin-assign"
    | "lead.admin-override-reassign"
    | "lead.status-change";
  actor: AuditActor;
  leadId: string;
  dealerId?: string;
  prevDealerId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      action: entry.action,
      actorType: entry.actor.actorType,
      actorId: entry.actor.actorId,
      leadId: entry.leadId,
      dealerId: entry.dealerId,
      prevDealerId: entry.prevDealerId,
      reason: entry.reason,
      metadata: entry.metadata,
    });
  } catch {
    /* audit is best-effort - never break the assignment on a log failure */
  }
}

/**
 * The exactly-once side effects after a lead has been (atomically) claimed for a
 * dealer: bump the dealer counters, the listing lead count, and fire the
 * template. Call ONLY after a successful claim.
 */
export async function applyAssignSideEffects(
  dealerId: string,
  claimedLead: LeadForTemplate & { listingId?: unknown },
  now: Date,
): Promise<{ templateSent: boolean }> {
  await Dealer.updateOne(
    { _id: dealerId },
    {
      $inc: { leadsUsedThisMonth: 1, totalLeadsReceived: 1 },
      $set: { lastAssignedAt: now },
    },
  );
  if (claimedLead.listingId) {
    await Listing.updateOne(
      { _id: claimedLead.listingId },
      { $inc: { leadCount: 1 } },
    );
  }
  const templateSent = await sendLeadAssigned(dealerId, claimedLead);
  return { templateSent };
}

// ---- admin flows ----

export type AdminAssignResult =
  | { ok: true; action: "assigned" | "reassigned"; dealerId: string; templateSent: boolean }
  | { ok: false; error: string };

/**
 * ADMIN: manually place an UNMATCHED lead onto a chosen dealer. Same atomic
 * claim as the router (only assigns while still unassigned), same side effects,
 * plus an audit record. The dealer must be active.
 */
export async function adminAssignUnmatched(
  leadId: string,
  dealerId: string,
  adminId: string,
): Promise<AdminAssignResult> {
  if (!mongoose.Types.ObjectId.isValid(leadId) || !mongoose.Types.ObjectId.isValid(dealerId)) {
    return { ok: false, error: "Invalid id." };
  }
  await connectDB();

  const dealer = await Dealer.findById(dealerId, { status: 1 }).lean();
  if (!dealer) return { ok: false, error: "Dealer not found." };
  if (dealer.status !== "active") return { ok: false, error: "Dealer is not active." };

  const now = new Date();
  // Atomic claim: only assign if still unassigned (never steals a locked lead).
  const claimed = await Lead.findOneAndUpdate(
    { _id: leadId, assignedDealerId: null },
    {
      $set: {
        assignedDealerId: new mongoose.Types.ObjectId(dealerId),
        assignedAt: now,
        isLocked: true,
        status: "assigned",
      },
    },
    { new: true },
  );
  if (!claimed) {
    return { ok: false, error: "Lead is already assigned - use override to reassign." };
  }

  const { templateSent } = await applyAssignSideEffects(dealerId, claimed, now);
  await logAudit({
    action: "lead.admin-assign",
    actor: { actorType: "admin", actorId: adminId },
    leadId,
    dealerId,
    reason: "admin manual assignment of an unmatched lead",
  });
  return { ok: true, action: "assigned", dealerId, templateSent };
}

/**
 * ADMIN OVERRIDE: reassign an ALREADY-assigned (locked) lead to a different
 * dealer. This is the single, explicit, admin-only exception to the exclusivity
 * lock (Section 12). It is deliberately NOT reachable by any automatic path -
 * only this function, called from the admin route. The previous dealer's quota
 * is refunded and the new dealer's is charged, and the move is audited.
 */
export async function adminOverrideReassign(
  leadId: string,
  newDealerId: string,
  adminId: string,
  reason: string,
): Promise<AdminAssignResult> {
  if (!mongoose.Types.ObjectId.isValid(leadId) || !mongoose.Types.ObjectId.isValid(newDealerId)) {
    return { ok: false, error: "Invalid id." };
  }
  await connectDB();

  const lead = await Lead.findById(leadId);
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.assignedDealerId) {
    return { ok: false, error: "Lead is not assigned yet - use assign, not override." };
  }
  const prevDealerId = String(lead.assignedDealerId);
  if (prevDealerId === newDealerId) {
    return { ok: false, error: "Lead is already assigned to that dealer." };
  }

  const newDealer = await Dealer.findById(newDealerId, { status: 1 }).lean();
  if (!newDealer) return { ok: false, error: "Target dealer not found." };
  if (newDealer.status !== "active") return { ok: false, error: "Target dealer is not active." };

  const now = new Date();
  // Unconditional move (the lead is locked; this is the sanctioned override).
  lead.set({
    assignedDealerId: new mongoose.Types.ObjectId(newDealerId),
    assignedAt: now,
    isLocked: true,
    status: "assigned",
  });
  await lead.save();

  // Refund the previous dealer's quota, charge the new dealer.
  await Dealer.updateOne(
    { _id: prevDealerId, leadsUsedThisMonth: { $gt: 0 } },
    { $inc: { leadsUsedThisMonth: -1 } },
  );
  const { templateSent } = await applyAssignSideEffects(newDealerId, lead, now);

  await logAudit({
    action: "lead.admin-override-reassign",
    actor: { actorType: "admin", actorId: adminId },
    leadId,
    dealerId: newDealerId,
    prevDealerId,
    reason: reason || "admin override reassignment",
  });
  return { ok: true, action: "reassigned", dealerId: newDealerId, templateSent };
}
