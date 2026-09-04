import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { getMyLeads } from "@/lib/leads/dealer-leads";

/**
 * GET /api/leads   [dealer auth]   (DEV-SPEC.txt Section 7)
 *   -> only leads where assignedDealerId === self, newest first, paginated.
 *
 * Ownership is enforced inside getMyLeads (scoped to the session dealerId).
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireDealer();
  if ("error" in auth) return auth.error;

  const params = req.nextUrl.searchParams;
  const result = await getMyLeads({
    status: params.get("status") ?? undefined,
    page: Number(params.get("page") ?? "1") || 1,
  });
  if (!result) return fail("UNAUTHORIZED", "Please sign in as a dealer.");
  return ok(result);
});
