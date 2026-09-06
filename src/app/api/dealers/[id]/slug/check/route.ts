import type { NextRequest } from "next/server";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { validateDealerSlug } from "@/lib/dealers/slug";
import { isDealerSlugAvailable } from "@/lib/dealers/slug-server";

/**
 * GET /api/dealers/[id]/slug/check?slug=...   [dealer auth, self]
 *
 * Live availability for the edit field (username-style). Returns
 * { available, reason? } — validates the format first, then checks the DB.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/slug/check">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only check your own link.");
    }

    const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim().toLowerCase();
    const format = validateDealerSlug(slug);
    if (!format.ok) return ok({ available: false, reason: format.reason });

    const available = await isDealerSlugAvailable(slug, id);
    return ok({
      available,
      ...(available ? {} : { reason: "That link is already taken. Try another." }),
    });
  },
);
