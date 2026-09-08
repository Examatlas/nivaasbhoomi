import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { logDealerAudit } from "@/lib/dealers/audit";

/**
 * PATCH /api/admin/dealers/[id]/quota   [admin]   { maxLeadsPerMonth }
 *
 * Manually set a dealer's monthly lead quota (STEP 3.6). Audit-logged. The used
 * count is clamped to never exceed the new max and never go negative, so a quota
 * can never end up inconsistent from an admin edit.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  maxLeadsPerMonth: z.number().int().min(0).max(100000),
});

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]/quota">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("NOT_FOUND", "Dealer not found.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "A valid quota is required.");

    await connectDB();
    const dealer = await Dealer.findById(id, { maxLeadsPerMonth: 1, leadsUsedThisMonth: 1 });
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    const prevMax = dealer.maxLeadsPerMonth ?? 0;
    const newMax = parsed.data.maxLeadsPerMonth;
    dealer.maxLeadsPerMonth = newMax;
    // Keep used within [0, max] so quota can never be negative or overshoot.
    dealer.leadsUsedThisMonth = Math.min(newMax, Math.max(0, dealer.leadsUsedThisMonth ?? 0));
    await dealer.save();

    await logDealerAudit({
      action: "dealer.quota-adjust",
      actorId: auth.identity.adminId,
      dealerId: String(dealer._id),
      reason: `Quota ${prevMax} → ${newMax}`,
      metadata: { prevMax, newMax },
    });

    return ok({ maxLeadsPerMonth: newMax, leadsUsedThisMonth: dealer.leadsUsedThisMonth });
  },
);
