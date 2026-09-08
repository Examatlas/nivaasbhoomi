import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { archiveExpiredSeedListings } from "@/lib/listings/seed-admin";

/**
 * GET/POST /api/cron/expire-seed-listings
 *
 * Archives seed (display-only) listings whose seedExpiresAt has passed — they
 * were temporary placeholders. Protected by CRON_SECRET. NOT in vercel.json
 * (Hobby); an external scheduler hits it. Idempotent; never touches real listings.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("SERVER_ERROR", "CRON_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("UNAUTHORIZED", "Invalid cron secret.");
  }
  return ok(await archiveExpiredSeedListings());
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
