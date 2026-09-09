import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { getLastDealerNotification } from "@/lib/notifications/dealer-events";

/**
 * GET /api/admin/notifications/status?entityId=<id>   [admin]
 *
 * Last dealer-lifecycle WhatsApp notification for an entity (a listingId or a
 * dealerId), for the admin "was the dealer notified?" indicator. Read-only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const entityId = req.nextUrl.searchParams.get("entityId")?.trim();
  if (!entityId) return fail("VALIDATION_ERROR", "entityId is required.");

  const notification = await getLastDealerNotification(entityId);
  return ok({ notification });
});
