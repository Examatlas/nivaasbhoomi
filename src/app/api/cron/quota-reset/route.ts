import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { resetExpiredQuotas } from "@/lib/leads/quota";

/**
 * GET/POST /api/cron/quota-reset  (DEV-SPEC.txt Section 12)
 *
 * Daily job (schedule for 00:05 IST) that resets each dealer's monthly lead
 * quota once their quotaResetAt has passed. Protected by CRON_SECRET: the caller
 * must send `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this
 * automatically when CRON_SECRET is set). Without a configured secret the route
 * refuses, so it can never be triggered anonymously.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return fail("SERVER_ERROR", "CRON_SECRET is not configured.");
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.");
  }
  const result = await resetExpiredQuotas();
  return ok(result);
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
