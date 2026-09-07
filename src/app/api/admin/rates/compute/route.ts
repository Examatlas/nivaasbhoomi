import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { computeLocalityRates } from "@/lib/rates/compute";

/**
 * POST /api/admin/rates/compute   [admin]
 * The "Compute now" button on /admin/rates — runs the aggregation immediately.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return ok(await computeLocalityRates());
});
