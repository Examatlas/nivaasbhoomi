import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";

/**
 * POST /api/dealers/leads/[id]/view   [dealer auth, self]
 *
 * Reveals the buyer's phone and records the FIRST view server-side (viewedAt).
 * Idempotent: a second call never changes viewedAt (the SLA clock is set once).
 * Scoped to the dealer the lead is assigned to — no cross-dealer reveal.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/dealers/leads/[id]/view">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid id.");

    await connectDB();
    const dealerObjId = new mongoose.Types.ObjectId(auth.identity.dealerId);
    const lead = await Lead.findOne({ _id: id, assignedDealerId: dealerObjId });
    if (!lead) return fail("NOT_FOUND", "Lead not found.");

    if (!lead.viewedAt) {
      const now = new Date();
      lead.viewedAt = now;
      // Stamp the CURRENT (unviewed) assignment-history entry for this dealer.
      const hist = lead.assignmentHistory ?? [];
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i]?.dealerId?.equals(dealerObjId) && !hist[i]?.viewedAt) {
          hist[i]!.viewedAt = now;
          break;
        }
      }
      await lead.save();
    }

    return ok({ phone: lead.phone, viewedAt: lead.viewedAt });
  },
);
