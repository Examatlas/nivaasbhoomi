import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { adminReassignLead } from "@/lib/leads/assign";

/**
 * POST /api/leads/[id]/assign   [admin auth]   (DEV-SPEC.txt Sections 7, 12, 15)
 *   body: { dealerId, reason? }
 *
 * The single admin entry point for manually (re)assigning ANY non-closed lead
 * (assigned, unassigned, unclaimed, viewed, unviewed) to a chosen active dealer.
 * Refunds the previous dealer's quota, charges the new one, records a "manual"
 * assignment-history entry with the admin's note, resets the SLA (except
 * whatsapp_click), and does NOT count toward the SLA cron's auto-reassign limit.
 * Admin-only; no automatic path can reach it.
 */
const bodySchema = z.object({
  dealerId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/leads/[id]/assign">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "dealerId is required.", parsed.error.flatten());
    }

    const result = await adminReassignLead(
      id,
      parsed.data.dealerId,
      auth.identity.adminId,
      parsed.data.reason,
    );

    if (!result.ok) {
      const conflict = /already assigned to that dealer/i.test(result.error);
      return fail(conflict ? "DUPLICATE" : "VALIDATION_ERROR", result.error);
    }
    return ok(result);
  },
);
