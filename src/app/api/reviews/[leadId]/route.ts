import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { submitReview } from "@/lib/leads/reviews";

/**
 * POST /api/reviews/[leadId]   (public - buyer-facing, DEV-SPEC.txt Section 13)
 *   body: { rating: 1-5, comment? }
 *
 * No auth: the leadId in the review link is the capability token. submitReview
 * enforces that the lead is 'site-visit-done' and not already reviewed (an
 * atomic guard), so only a genuine post-visit buyer can leave one review.
 */
const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/reviews/[leadId]">) => {
    const { leadId } = await ctx.params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "A rating from 1 to 5 is required.");
    }

    const result = await submitReview(leadId, parsed.data.rating, parsed.data.comment);
    if (!result.ok) return fail("FORBIDDEN", result.error);
    return ok(result);
  },
);
