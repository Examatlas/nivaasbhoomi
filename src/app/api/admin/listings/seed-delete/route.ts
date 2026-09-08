import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { deleteSeedListingsInCity } from "@/lib/listings/seed-admin";

/**
 * POST /api/admin/listings/seed-delete   [admin]   { cityId }
 * Bulk-delete (archive) every seed listing in a city. Real listings untouched.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ cityId: z.string().min(1) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A cityId is required.");

  return ok(await deleteSeedListingsInCity(parsed.data.cityId));
});
