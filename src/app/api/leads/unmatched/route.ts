import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { getUnmatchedByCity } from "@/lib/leads/admin-leads";

/**
 * GET /api/leads/unmatched   [admin auth]   (DEV-SPEC.txt Sections 7, 12, 15)
 *   -> unmatched + quota-exceeded leads, GROUPED BY city (the sales signal).
 */
export const GET = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return ok(await getUnmatchedByCity());
});
