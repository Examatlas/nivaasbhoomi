import { connectDB } from "@/lib/db/connect";
import { syncAllStateActivation } from "@/lib/locations/activation";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/locations/states/sync   [admin]
 *
 * Backfill every state's isActive from its cities (active iff it has an active
 * city). Cities now auto-sync their state on (de)activation, so this is mainly
 * a one-time backfill for states that were left inactive despite having an
 * already-active city.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const res = await syncAllStateActivation();
  return ok(res);
});
