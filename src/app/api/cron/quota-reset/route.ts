import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { resetMonthlyQuotas } from "@/lib/leads/quota";
import { isFirstOfMonthIST } from "@/lib/leads/quota-reset-date";

/**
 * GET/POST /api/cron/quota-reset  (STEP 3.2)
 *
 * Run DAILY by an external scheduler (NOT in vercel.json). The job itself
 * decides whether to act: it resets the monthly lead quota only on the 1st of
 * the month (IST). The reset is idempotent, so a second hit on the 1st is a
 * no-op. Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>);
 * without a configured secret it refuses.
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
  // Calendar reset: act only on the 1st (IST). Other days are a no-op.
  if (!isFirstOfMonthIST()) {
    return ok({ skipped: true, reason: "not the 1st of the month (IST)", reset: 0 });
  }
  const result = await resetMonthlyQuotas();
  return ok(result);
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
