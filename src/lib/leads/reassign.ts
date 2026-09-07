import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { sendEmail } from "@/lib/email/mailer";
import { BRAND } from "@/lib/seo/site";
import { applyAssignSideEffects, logAudit } from "@/lib/leads/assign";
import { hasQuota, rankCandidates, SLA_MS, type DealerLite } from "@/lib/leads/routing";

/** Max AUTOMATIC reassignments before a lead falls to the admin queue. */
export const MAX_REASSIGN = 3;

/** Whether the SLA cron's auto-reassign limit is exhausted. Counts ONLY auto
 *  reassignments — admin manual reassigns bump reassignCount, not this, so they
 *  never exhaust the limit (admins get unlimited manual reassigns). */
export function hasExhaustedAutoReassign(autoReassignCount: number, max = MAX_REASSIGN): boolean {
  return autoReassignCount >= max;
}

/** Pure: which leads the SLA cron may touch — assigned, unviewed, past deadline,
 *  and NOT a whatsapp_click lead (exempt) or a lead-magnet tool lead (never
 *  auto-assigned, so never auto-reassigned; they wait for a manual admin assign).
 *  Tool leads are also "unassigned", so the status gate already excludes them —
 *  the explicit source check is defence in depth. */
export function isReassignEligible(
  lead: { status: string; viewedAt?: Date | null; slaDeadline?: Date | null; source: string },
  now: Date = new Date(),
): boolean {
  return (
    lead.status === "assigned" &&
    !lead.viewedAt &&
    !!lead.slaDeadline &&
    lead.slaDeadline.getTime() <= now.getTime() &&
    lead.source !== "whatsapp_click" &&
    !lead.source.startsWith("tool_")
  );
}

export type ReassignOutcome =
  | { outcome: "reassigned"; leadId: string; fromDealerId: string; toDealerId: string }
  | { outcome: "unclaimed"; leadId: string; reason: "max_reassign" | "no_eligible_dealer" }
  | { outcome: "skip"; leadId: string; reason: string };

function toLite(d: {
  _id: unknown;
  status?: string;
  verificationTier?: number;
  rating?: number;
  leadsUsedThisMonth?: number;
  maxLeadsPerMonth?: number;
  lastAssignedAt?: Date | null;
  coverageCities?: unknown[];
  coverageLocalities?: unknown[];
}): DealerLite {
  return {
    id: String(d._id),
    status: (d.status as DealerLite["status"]) ?? "active",
    verificationTier: d.verificationTier ?? 0,
    rating: d.rating ?? 0,
    leadsUsedThisMonth: d.leadsUsedThisMonth ?? 0,
    maxLeadsPerMonth: d.maxLeadsPerMonth ?? 0,
    lastAssignedAt: d.lastAssignedAt ? new Date(d.lastAssignedAt).getTime() : null,
    coverageCities: (d.coverageCities ?? []).map(String),
    coverageLocalities: (d.coverageLocalities ?? []).map(String),
  };
}

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
 * Transfer ONE unviewed, SLA-expired lead to the next eligible dealer. Reuses the
 * same eligibility + ranking as the initial rotation (active + covers the lead's
 * city/locality + has quota), never re-picking a dealer already in the lead's
 * history. Refunds the previous (non-responding) dealer's quota, charges the new
 * one, resets the SLA, and audits the move. After MAX_REASSIGN, or when no dealer
 * is eligible, the lead becomes "unclaimed" for the admin queue. Never throws.
 */
export async function reassignExpiredLead(leadId: string): Promise<ReassignOutcome> {
  try {
    await connectDB();
    const lead = await Lead.findById(leadId);
    if (!lead) return { outcome: "skip", leadId, reason: "not found" };

    if (!isReassignEligible(lead)) {
      return { outcome: "skip", leadId, reason: "not eligible for reassign" };
    }

    const fromDealerId = lead.assignedDealerId ? String(lead.assignedDealerId) : null;

    // Exhausted AUTO attempts → admin queue. Manual admin reassigns don't count
    // (they bump reassignCount but not autoReassignCount).
    if (hasExhaustedAutoReassign(lead.autoReassignCount ?? 0)) {
      lead.status = "unclaimed";
      await lead.save();
      if (fromDealerId) {
        await notifyDealerEmail(
          fromDealerId,
          "A lead was transferred",
          "A lead you did not view in time has been moved to our team for reassignment.",
        );
      }
      return { outcome: "unclaimed", leadId, reason: "max_reassign" };
    }

    // Coverage city/locality: from the listing for listing leads, else the lead.
    let cityId = lead.cityId ? String(lead.cityId) : null;
    let localityId = lead.localityId ? String(lead.localityId) : null;
    if (lead.listingId) {
      const listing = await Listing.findById(lead.listingId, { cityId: 1, localityId: 1 }).lean();
      if (listing?.cityId) cityId = String(listing.cityId);
      if (listing?.localityId) localityId = String(listing.localityId);
    }

    let toDealerId: string | null = null;
    if (cityId) {
      const seen = new Set<string>((lead.assignmentHistory ?? []).map((h) => String(h.dealerId)));
      if (fromDealerId) seen.add(fromDealerId);

      const rows = await Dealer.find({
        status: "active", // excludes pending / paused / banned
        coverageCities: new mongoose.Types.ObjectId(cityId),
      }).lean();
      let candidates = rows.map(toLite).filter((d) => hasQuota(d) && !seen.has(d.id));
      if (localityId) {
        const narrowed = candidates.filter((d) => d.coverageLocalities.includes(localityId!));
        if (narrowed.length > 0) candidates = narrowed;
      }
      const top = rankCandidates(candidates)[0];
      toDealerId = top ? top.id : null;
    }

    if (!toDealerId) {
      lead.status = "unclaimed";
      await lead.save();
      if (fromDealerId) {
        await notifyDealerEmail(
          fromDealerId,
          "A lead was withdrawn",
          "A lead you did not view in time has been withdrawn (no other dealer was available).",
        );
      }
      return { outcome: "unclaimed", leadId, reason: "no_eligible_dealer" };
    }

    const now = new Date();
    // Refund the non-responding dealer's quota (the lead was never used).
    if (fromDealerId) {
      await Dealer.updateOne(
        { _id: fromDealerId, leadsUsedThisMonth: { $gt: 0 } },
        { $inc: { leadsUsedThisMonth: -1 } },
      );
    }

    const toOid = new mongoose.Types.ObjectId(toDealerId);
    const updated = await Lead.findByIdAndUpdate(
      leadId,
      {
        $set: {
          assignedDealerId: toOid,
          assignedAt: now,
          isLocked: true,
          status: "assigned",
          viewedAt: null,
          slaDeadline: new Date(now.getTime() + SLA_MS),
        },
        $inc: { reassignCount: 1, autoReassignCount: 1 },
        $push: {
          assignmentHistory: { dealerId: toOid, assignedAt: now, viewedAt: null, reason: "sla_timeout" },
        },
      },
      { new: true },
    );

    // Charge the new dealer + fire the WhatsApp template (via side effects).
    await applyAssignSideEffects(toDealerId, updated ?? lead, now);
    await logAudit({
      action: "lead.admin-override-reassign",
      actor: { actorType: "system", actorId: "sla-cron" },
      leadId,
      dealerId: toDealerId,
      prevDealerId: fromDealerId ?? undefined,
      reason: "SLA timeout auto-reassign",
    });

    await notifyDealerEmail(
      toDealerId,
      "You have a new lead",
      "A new buyer lead has been assigned to you. View it before the response deadline.",
    );
    if (fromDealerId) {
      await notifyDealerEmail(
        fromDealerId,
        "A lead was transferred",
        "A lead you did not view in time has been transferred to another dealer. Your quota was refunded.",
      );
    }

    return { outcome: "reassigned", leadId, fromDealerId: fromDealerId ?? "", toDealerId };
  } catch (e) {
    return { outcome: "skip", leadId, reason: e instanceof Error ? e.message : "reassign error" };
  }
}

/** Find + reassign all expired, unviewed leads (the SLA cron entry point). */
export async function runSlaReassign(
  limit = 200,
): Promise<{ scanned: number; reassigned: number; unclaimed: number }> {
  await connectDB();
  const due = await Lead.find(
    {
      status: "assigned",
      viewedAt: null,
      slaDeadline: { $lte: new Date() },
      source: { $ne: "whatsapp_click" },
    },
    { _id: 1 },
  )
    .limit(limit)
    .lean();

  let reassigned = 0;
  let unclaimed = 0;
  for (const l of due) {
    const r = await reassignExpiredLead(String(l._id));
    if (r.outcome === "reassigned") reassigned += 1;
    else if (r.outcome === "unclaimed") unclaimed += 1;
  }
  return { scanned: due.length, reassigned, unclaimed };
}
