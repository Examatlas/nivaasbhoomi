import { getWhatsAppHealth } from "@/lib/whatsapp/provider";
import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * GET /api/admin/whatsapp/health   [admin]
 *
 * Outbound WhatsApp health: the active provider and, over the last 24h, how many
 * sends went via Zenith, how many fell back to Meta, and how many failed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return ok(await getWhatsAppHealth());
});
