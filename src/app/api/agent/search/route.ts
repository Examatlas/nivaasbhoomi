import type { NextRequest } from "next/server";

import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAgentDealer, logAgentRequest } from "@/lib/agent/auth";
import { agentSearch, type AgentSearchParams } from "@/lib/agent/search";

/**
 * GET /api/agent/search   [dealer agent key]
 *
 * Returns ONLY the authenticated dealer's approved, non-seed listings. Scope is
 * the dealerId from the key — never a client param. Cursor-paginated.
 * Params: city, locality, type, purpose, budget_min, budget_max, bhk,
 *         listingId, limit (default 10, max 25), cursor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: string | null): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  const start = Date.now();
  const guard = await requireAgentDealer(req);
  if ("error" in guard) return guard.error;
  const { dealerId } = guard.ctx;

  const sp = req.nextUrl.searchParams;
  const purpose = sp.get("purpose");
  const params: AgentSearchParams = {
    city: sp.get("city") ?? undefined,
    locality: sp.get("locality") ?? undefined,
    type: sp.get("type") ?? undefined,
    purpose: purpose === "rent" ? "rent" : purpose === "sale" ? "sale" : undefined,
    budgetMin: num(sp.get("budget_min")),
    budgetMax: num(sp.get("budget_max")),
    bhk: sp.get("bhk") ?? undefined,
    listingId: sp.get("listingId") ?? undefined,
    limit: num(sp.get("limit")),
    cursor: sp.get("cursor") ?? undefined,
  };

  const result = await agentSearch(dealerId, params);
  const res = ok(result);
  await logAgentRequest(dealerId, "search", 200, Date.now() - start);
  return res;
});
