import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { setListingSeed } from "@/lib/listings/seed-admin";

/**
 * POST /api/admin/listings/[id]/seed   [admin]
 *   body: { isSeed: boolean, seedExpiresAt?: string (ISO) }
 * Mark / unmark a listing as a seed (display-only) listing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  isSeed: z.boolean(),
  seedExpiresAt: z.string().datetime().nullable().optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]/seed">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid request.");

    const okSet = await setListingSeed(
      id,
      parsed.data.isSeed,
      parsed.data.seedExpiresAt ? new Date(parsed.data.seedExpiresAt) : undefined,
    );
    if (!okSet) return fail("NOT_FOUND", "Listing not found.");
    return ok({ id, isSeed: parsed.data.isSeed });
  },
);
