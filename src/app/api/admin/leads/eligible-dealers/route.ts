import type { NextRequest } from "next/server";

import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { getEligibleDealers } from "@/lib/leads/admin-leads";

/**
 * GET /api/admin/leads/eligible-dealers?cityId=   [admin]
 * Active dealers the admin can (re)assign a lead to — coverage matches first.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const cityId = req.nextUrl.searchParams.get("cityId") ?? undefined;
  return ok({ dealers: await getEligibleDealers(cityId) });
});
