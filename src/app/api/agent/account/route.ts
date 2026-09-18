import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAgentDealer, logAgentRequest } from "@/lib/agent/auth";
import { getMyAgentDealer } from "@/lib/agent/dealer";

/**
 * GET /api/agent/account   [dealer agent key]
 *
 * Returns the authenticated key's own dealer account (name, business profile,
 * verification, rating, coverage, plan/quota) — no params, always "who am I".
 * The same object embedded as `dealer` in /api/agent/search, exposed on its
 * own for callers that only need the profile, not listings.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const start = Date.now();
  const guard = await requireAgentDealer(req);
  if ("error" in guard) return guard.error;
  const { dealerId } = guard.ctx;

  const dealer = await getMyAgentDealer(dealerId);
  if (!dealer) {
    await logAgentRequest(dealerId, "account", 404, Date.now() - start);
    return fail("NOT_FOUND", "Dealer not found.");
  }

  const res = ok(dealer);
  await logAgentRequest(dealerId, "account", 200, Date.now() - start);
  return res;
});
