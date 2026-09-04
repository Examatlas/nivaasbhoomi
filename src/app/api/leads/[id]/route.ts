import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { LEAD_STATUSES } from "@/lib/leads/dealer-leads";
import { logAudit } from "@/lib/leads/assign";

/**
 * PATCH /api/leads/[id]   [dealer auth, owner]   (DEV-SPEC.txt Sections 7, 13)
 *   body: { status?, dealerNotes? }
 *
 * A dealer can ONLY edit their OWN lead, and ONLY its status (within the
 * lifecycle) and dealerNotes - nothing else. Ownership is enforced by scoping
 * the update to { _id, assignedDealerId: session.dealerId }; a lead belonging to
 * another dealer returns NOT_FOUND (no existence leak).
 */
const bodySchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    dealerNotes: z.string().trim().max(4000).optional(),
  })
  .refine((b) => b.status !== undefined || b.dealerNotes !== undefined, {
    message: "Nothing to update.",
  });

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/leads/[id]">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("NOT_FOUND", "Lead not found.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "status and/or dealerNotes only.", parsed.error.flatten());
    }

    await connectDB();
    const set: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) set.status = parsed.data.status;
    if (parsed.data.dealerNotes !== undefined) set.dealerNotes = parsed.data.dealerNotes;

    // Ownership-scoped update: only touches a lead assigned to THIS dealer.
    const res = await Lead.findOneAndUpdate(
      {
        _id: id,
        assignedDealerId: new mongoose.Types.ObjectId(auth.identity.dealerId),
      },
      { $set: set },
      { new: true, projection: { status: 1 } },
    );
    if (!res) return fail("NOT_FOUND", "Lead not found.");

    if (parsed.data.status !== undefined) {
      await logAudit({
        action: "lead.status-change",
        actor: { actorType: "dealer", actorId: auth.identity.dealerId },
        leadId: id,
        dealerId: auth.identity.dealerId,
        reason: `status -> ${parsed.data.status}`,
      });
    }

    return ok({ id, status: res.status });
  },
);
