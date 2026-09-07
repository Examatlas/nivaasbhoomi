import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { computeLocalityRates } from "@/lib/rates/compute";

/**
 * GET/POST /api/cron/compute-locality-rates
 *
 * Recomputes LocalityRate + CityRate aggregates from approved listings.
 * Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>). NOT in
 * vercel.json (Hobby) — an external scheduler hits it. Idempotent.
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
  return ok(await computeLocalityRates());
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
