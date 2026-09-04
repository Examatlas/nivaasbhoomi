import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { sendBusinessText } from "@/lib/whatsapp/send";
import { applyAssignSideEffects, logAudit } from "@/lib/leads/assign";

/**
 * Lead routing engine (DEV-SPEC.txt Section 12) — the core of the business.
 *
 * RULE 1: one lead -> exactly one dealer, exclusively. Once assigned,
 * isLocked = true and the lead is NEVER reassigned (except an explicit admin
 * override, which is a separate deliberate action, not this engine).
 *
 * Design: the DECISION is a pure function (`decideRoute` + helpers) over plain
 * data, so it is exhaustively unit-testable with no database. The impure
 * `routeLead` orchestrator loads the data, calls the decision, then performs the
 * assignment with an ATOMIC claim (findOneAndUpdate filtered on
 * assignedDealerId: null) so a re-run can never double-assign or double-count
 * quota, even under concurrency.
 */

// ---- pure decision layer ----

export interface DealerLite {
  id: string;
  status: "active" | "paused" | "banned";
  verificationTier: number;
  rating: number;
  leadsUsedThisMonth: number;
  maxLeadsPerMonth: number;
  /** Epoch ms of the last assignment, or null if never assigned. */
  lastAssignedAt: number | null;
  coverageCities: string[];
  coverageLocalities: string[];
}

export interface LeadLite {
  assignedDealerId: string | null;
  listingId: string | null;
  cityId: string | null;
  localityId: string | null;
}

export type RoutingDecision =
  | { action: "assign"; dealerId: string; reason: string }
  | { action: "unmatched"; reason: string }
  | { action: "quota-exceeded"; dealerId: string; reason: string }
  | { action: "already-assigned"; dealerId: string; reason: string }
  | { action: "skip"; reason: string };

/** A dealer has room for another lead this month. */
export function hasQuota(d: DealerLite): boolean {
  return d.leadsUsedThisMonth < d.maxLeadsPerMonth;
}

/**
 * Rank generic-lead candidates (Section 12): verificationTier DESC, then rating
 * DESC, then lastAssignedAt ASC (round-robin fairness - a dealer who was
 * assigned longest ago, or never, comes first). Returns a new sorted array;
 * never mutates the input.
 */
export function rankCandidates(candidates: DealerLite[]): DealerLite[] {
  return [...candidates].sort((a, b) => {
    if (a.verificationTier !== b.verificationTier) {
      return b.verificationTier - a.verificationTier;
    }
    if (a.rating !== b.rating) return b.rating - a.rating;
    // null (never assigned) sorts first via 0.
    return (a.lastAssignedAt ?? 0) - (b.lastAssignedAt ?? 0);
  });
}

/** CASE A: listing-based lead -> the listing's owner dealer only. */
export function decideListingLead(
  owner: DealerLite | null,
): RoutingDecision {
  if (!owner) {
    return { action: "unmatched", reason: "listing or owner dealer not found" };
  }
  if (owner.status !== "active") {
    return { action: "unmatched", reason: `owner dealer is ${owner.status}` };
  }
  if (!hasQuota(owner)) {
    return {
      action: "quota-exceeded",
      dealerId: owner.id,
      reason: "owner dealer is over their monthly lead quota",
    };
  }
  return {
    action: "assign",
    dealerId: owner.id,
    reason: "listing owner, active, within quota",
  };
}

/** CASE B: generic lead -> best active, in-coverage, in-quota dealer. */
export function decideGenericLead(
  lead: LeadLite,
  dealers: DealerLite[],
): RoutingDecision {
  if (!lead.cityId) {
    return { action: "unmatched", reason: "lead has no city to match coverage" };
  }

  // Active + covers the city + has quota remaining.
  let candidates = dealers.filter(
    (d) =>
      d.status === "active" &&
      d.coverageCities.includes(lead.cityId!) &&
      hasQuota(d),
  );

  // Narrow to locality coverage when known - but only if it keeps >= 1 candidate.
  if (lead.localityId) {
    const localityMatch = candidates.filter((d) =>
      d.coverageLocalities.includes(lead.localityId!),
    );
    if (localityMatch.length > 0) candidates = localityMatch;
  }

  if (candidates.length === 0) {
    return {
      action: "unmatched",
      reason: "no active in-coverage dealer with quota (SALES SIGNAL: city needs dealers)",
    };
  }

  const top = rankCandidates(candidates)[0]!;
  return {
    action: "assign",
    dealerId: top.id,
    reason: "top-ranked candidate (tier, then rating, then round-robin)",
  };
}

/**
 * Full decision. An already-assigned lead is a hard stop (exclusivity) - this
 * function has NO path that moves an assigned lead to a second dealer.
 */
export function decideRoute(
  lead: LeadLite,
  ctx: { owner?: DealerLite | null; dealers?: DealerLite[] },
): RoutingDecision {
  if (lead.assignedDealerId) {
    return {
      action: "already-assigned",
      dealerId: lead.assignedDealerId,
      reason: "lead is already assigned (locked, never reassigned)",
    };
  }
  if (lead.listingId) {
    return decideListingLead(ctx.owner ?? null);
  }
  return decideGenericLead(lead, ctx.dealers ?? []);
}

// ---- impure orchestrator ----

export interface RouteResult {
  decision: RoutingDecision["action"];
  reason: string;
  leadId: string;
  dealerId?: string;
  /** True only when THIS call performed the assignment (won the atomic claim). */
  assignedNow?: boolean;
  templateSent?: boolean;
}

function toDealerLite(d: {
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

/**
 * Route ONE lead (Section 12). Idempotent + exclusive: the assignment is an
 * atomic findOneAndUpdate on { assignedDealerId: null }, so a second run finds
 * the lead already claimed and does nothing. NEVER throws.
 */
export async function routeLead(leadId: string): Promise<RouteResult> {
  try {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return { decision: "skip", reason: "invalid lead id", leadId };
    }
    await connectDB();

    const lead = await Lead.findById(leadId);
    if (!lead) return { decision: "skip", reason: "lead not found", leadId };

    // Early exclusivity stop.
    if (lead.assignedDealerId) {
      return {
        decision: "already-assigned",
        reason: "lead already assigned",
        leadId,
        dealerId: String(lead.assignedDealerId),
      };
    }

    const leadLite: LeadLite = {
      assignedDealerId: null,
      listingId: lead.listingId ? String(lead.listingId) : null,
      cityId: lead.cityId ? String(lead.cityId) : null,
      localityId: lead.localityId ? String(lead.localityId) : null,
    };

    // Gather the data each case needs.
    let owner: DealerLite | null = null;
    let dealers: DealerLite[] = [];
    if (leadLite.listingId) {
      const listing = await Listing.findById(leadLite.listingId, { dealerId: 1 }).lean();
      if (listing?.dealerId) {
        const ownerDoc = await Dealer.findById(listing.dealerId).lean();
        if (ownerDoc) owner = toDealerLite(ownerDoc);
      }
    } else if (leadLite.cityId) {
      const rows = await Dealer.find({
        status: "active",
        coverageCities: new mongoose.Types.ObjectId(leadLite.cityId),
      }).lean();
      dealers = rows.map(toDealerLite);
    }

    const decision = decideRoute(leadLite, { owner, dealers });

    switch (decision.action) {
      case "assign":
        return await performAssignment(lead, decision.dealerId, decision.reason);

      case "quota-exceeded": {
        // Claim it into the admin queue only if still unassigned.
        await Lead.updateOne(
          { _id: lead._id, assignedDealerId: null },
          { $set: { status: "quota-exceeded" } },
        );
        await notifyDealerUpgrade(decision.dealerId);
        return {
          decision: "quota-exceeded",
          reason: decision.reason,
          leadId,
          dealerId: decision.dealerId,
        };
      }

      case "unmatched":
        await Lead.updateOne(
          { _id: lead._id, assignedDealerId: null },
          { $set: { status: "unmatched" } },
        );
        return { decision: "unmatched", reason: decision.reason, leadId };

      case "already-assigned":
        return {
          decision: "already-assigned",
          reason: decision.reason,
          leadId,
          dealerId: decision.dealerId,
        };

      default:
        return { decision: "skip", reason: decision.reason, leadId };
    }
  } catch (err) {
    return {
      decision: "skip",
      reason: err instanceof Error ? err.message : "routing error",
      leadId,
    };
  }
}

/**
 * The atomic assignment (Section 12 `assign`). The lead claim is conditional on
 * assignedDealerId still being null; only if THIS call wins the claim do we
 * bump the dealer counters, the listing lead count, and fire the template - so
 * quota is counted exactly once.
 */
async function performAssignment(
  lead: mongoose.Document & { _id: unknown; listingId?: unknown },
  dealerId: string,
  reason: string,
): Promise<RouteResult> {
  const now = new Date();

  const claimed = await Lead.findOneAndUpdate(
    { _id: lead._id, assignedDealerId: null },
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
    // Someone/something else assigned it first - do NOT double count.
    const fresh = await Lead.findById(lead._id, { assignedDealerId: 1 }).lean();
    return {
      decision: "already-assigned",
      reason: "lost the assignment race; lead already claimed",
      leadId: String(lead._id),
      dealerId: fresh?.assignedDealerId ? String(fresh.assignedDealerId) : dealerId,
      assignedNow: false,
    };
  }

  // We won the claim - apply the exactly-once side effects + audit (Section 16).
  const { templateSent } = await applyAssignSideEffects(dealerId, claimed, now);
  await logAudit({
    action: "lead.auto-assign",
    actor: { actorType: "system", actorId: "routing" },
    leadId: String(lead._id),
    dealerId,
    reason,
  });

  return {
    decision: "assign",
    reason,
    leadId: String(lead._id),
    dealerId,
    assignedNow: true,
    templateSent,
  };
}

// ---- notifications ----

/**
 * Nudge an over-quota dealer to upgrade. There's no dedicated template in
 * Section 11, so this is a best-effort free-form message (delivered only inside
 * the 24h window); the admin queue (lead.status = 'quota-exceeded') is the
 * reliable mechanism.
 */
async function notifyDealerUpgrade(dealerId: string): Promise<void> {
  const dealer = await Dealer.findById(dealerId, { phone: 1 }).lean();
  if (!dealer?.phone) return;
  await sendBusinessText(
    dealer.phone,
    "You just missed a lead because your monthly lead quota is full. Upgrade your plan on NivaasBhoomi to receive more leads.",
  );
}
