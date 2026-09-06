import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { runSlaReassign } from "@/lib/leads/reassign";

/**
 * GET/POST /api/cron/lead-sla   (every 5 minutes)
 *
 * Auto-reassigns leads whose assigned dealer did not VIEW them before the SLA
 * deadline (whatsapp_click leads are exempt). Protected by CRON_SECRET
 * (Authorization: Bearer <CRON_SECRET>), exactly like the other cron jobs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("SERVER_ERROR", "CRON_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.");
  }
  return ok(await runSlaReassign());
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
