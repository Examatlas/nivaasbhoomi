import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { runPropertyAlerts } from "@/lib/alerts/notify";

/**
 * GET/POST /api/cron/property-alerts
 *
 * Sends WhatsApp property alerts for matching saved searches. Protected by
 * CRON_SECRET (Authorization: Bearer <CRON_SECRET>). NOT registered in
 * vercel.json (Hobby allows one cron/day) — an external scheduler hits this.
 * The engine self-limits to the 9am–8pm IST window, so it is safe to call any
 * time.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("SERVER_ERROR", "CRON_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.");
  }
  return ok(await runPropertyAlerts());
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
