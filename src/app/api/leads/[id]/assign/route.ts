import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { adminAssignUnmatched, adminOverrideReassign } from "@/lib/leads/assign";

/**
 * POST /api/leads/[id]/assign   [admin auth]   (DEV-SPEC.txt Sections 7, 12, 15)
 *   body: { dealerId, override?: boolean, reason? }
 *
 * The ONLY admin entry point for placing a lead by hand:
 *   - override=false (default): manually assign an UNMATCHED (unassigned) lead.
 *     Refuses if the lead is already assigned.
 *   - override=true: reassign an ALREADY-assigned (locked) lead to a different
 *     dealer - the single sanctioned exception to the exclusivity lock. Audited.
 *
 * Both paths apply the same assign() side effects (lock, counters, template) and
 * write an audit record. This admin-only route is the ONLY caller of the
 * override; no automatic path can reach it.
 */
const bodySchema = z.object({
  dealerId: z.string().min(1),
  override: z.boolean().default(false),
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

    const adminId = auth.identity.adminId;
    const result = parsed.data.override
      ? await adminOverrideReassign(
          id,
          parsed.data.dealerId,
          adminId,
          parsed.data.reason ?? "admin override reassignment",
        )
      : await adminAssignUnmatched(id, parsed.data.dealerId, adminId);

    if (!result.ok) {
      // A conflict (already assigned / not assigned) is a 409; other issues 422.
      const conflict = /already assigned|not assigned/i.test(result.error);
      return fail(conflict ? "DUPLICATE" : "VALIDATION_ERROR", result.error);
    }
    return ok(result);
  },
);
