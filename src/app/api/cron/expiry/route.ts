import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { runExpiry } from "@/lib/listings/expiry";

/**
 * GET/POST /api/cron/expiry   (DEV-SPEC.txt Section 13)
 *
 * Daily job (schedule for 02:00 IST) that expires overdue listings, recalculates
 * affected locality/city counters, and sends day-25 expiry warnings. Protected
 * by CRON_SECRET (Bearer); refuses if the secret isn't configured.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("SERVER_ERROR", "CRON_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.");
  }
  return ok(await runExpiry());
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
