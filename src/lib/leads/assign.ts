import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { Locality } from "@/lib/db/models/Locality";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { sendBusinessTemplate } from "@/lib/whatsapp/send";
import { sendEmail } from "@/lib/email/mailer";
import { BRAND } from "@/lib/seo/site";

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

// Response SLA window (kept here to avoid a circular import with routing.ts).
const SLA_MS = 30 * 60 * 1000;

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

  const res = await sendBusinessTemplate(dealer.phone, "lead_assigned", {
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

/** Closed leads (converted / lost) can never be reassigned; everything else can. */
export function canReassign(status: string): boolean {
  return status !== "converted" && status !== "lost";
}

/** New SLA deadline for a (re)assignment — null for whatsapp_click (SLA-exempt),
 *  otherwise now + 30 min so the new dealer also has a response window. */
export function slaDeadlineForReassign(source: string, now: Date): Date | null {
  return source === "whatsapp_click" ? null : new Date(now.getTime() + SLA_MS);
}

/** Best-effort dealer email notification (never throws). */
async function notifyDealerEmail(dealerId: string, subject: string, line: string): Promise<void> {
  const d = await Dealer.findById(dealerId, { email: 1 }).lean();
  if (!d?.email) return;
  await sendEmail({
    to: d.email,
    subject: `[${BRAND}] ${subject}`,
    text: `${line}\n\nOpen your dealer dashboard to see your leads.`,
    html: `<p>${line}</p><p>Open your dealer dashboard to see your leads.</p>`,
  }).catch(() => {});
}

/**
 * ADMIN manual (re)assignment — the single flow for placing ANY non-closed lead
 * onto a chosen active dealer, whether it was unassigned, assigned, unclaimed,
 * viewed or unviewed. Refunds the previous dealer's quota (if any), charges the
 * new one, records a "manual" assignment-history entry (with the admin's note),
 * resets viewedAt and the SLA (+30 min, except whatsapp_click which stays
 * SLA-exempt). Bumps reassignCount (total) but NOT autoReassignCount, so admin
 * reassigns are unlimited and never count toward the SLA cron's 3-transfer auto
 * limit. Emails both dealers. Audited. Admin-only (guarded by the route).
 */
export async function adminReassignLead(
  leadId: string,
  newDealerId: string,
  adminId: string,
  note?: string,
): Promise<AdminAssignResult> {
  if (!mongoose.Types.ObjectId.isValid(leadId) || !mongoose.Types.ObjectId.isValid(newDealerId)) {
    return { ok: false, error: "Invalid id." };
  }
  await connectDB();

  const lead = await Lead.findById(leadId);
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!canReassign(String(lead.status))) {
    return { ok: false, error: "A converted or lost lead cannot be reassigned." };
  }

  const newDealer = await Dealer.findById(newDealerId, { status: 1 }).lean();
  if (!newDealer) return { ok: false, error: "Target dealer not found." };
  if (newDealer.status !== "active") return { ok: false, error: "Target dealer is not active." };

  const prevDealerId = lead.assignedDealerId ? String(lead.assignedDealerId) : null;
  if (prevDealerId === newDealerId) {
    return { ok: false, error: "Lead is already assigned to that dealer." };
  }

  const now = new Date();
  const newOid = new mongoose.Types.ObjectId(newDealerId);
  const sla = slaDeadlineForReassign(String(lead.source), now);

  await Lead.updateOne(
    { _id: leadId },
    {
      $set: {
        assignedDealerId: newOid,
        assignedAt: now,
        isLocked: true,
        status: "assigned",
        viewedAt: null,
        slaDeadline: sla,
      },
      $inc: { reassignCount: 1 }, // total only — never autoReassignCount
      $push: {
        assignmentHistory: {
          dealerId: newOid,
          assignedAt: now,
          viewedAt: null,
          reason: "manual",
          ...(note ? { note } : {}),
        },
      },
    },
  );

  // Refund the previous dealer (if any); charge the new one + fire the template.
  if (prevDealerId) {
    await Dealer.updateOne(
      { _id: prevDealerId, leadsUsedThisMonth: { $gt: 0 } },
      { $inc: { leadsUsedThisMonth: -1 } },
    );
  }
  const fresh = (await Lead.findById(leadId)) ?? lead;
  const { templateSent } = await applyAssignSideEffects(newDealerId, fresh, now);

  await logAudit({
    action: prevDealerId ? "lead.admin-override-reassign" : "lead.admin-assign",
    actor: { actorType: "admin", actorId: adminId },
    leadId,
    dealerId: newDealerId,
    prevDealerId: prevDealerId ?? undefined,
    reason: note || "admin manual reassignment",
  });

  await notifyDealerEmail(
    newDealerId,
    "You have a new lead",
    "A lead has been assigned to you by our team. View it before the response deadline.",
  );
  if (prevDealerId) {
    await notifyDealerEmail(
      prevDealerId,
      "A lead was reassigned",
      "A lead has been moved to another dealer by our team. Your quota was refunded.",
    );
  }

  return {
    ok: true,
    action: prevDealerId ? "reassigned" : "assigned",
    dealerId: newDealerId,
    templateSent,
  };
}
