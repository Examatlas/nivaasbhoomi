import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { generateLocalitySlug } from "@/lib/utils/slug";
import { recalculateLocalityActivation } from "@/lib/locations/activation";

/**
 * POST /api/admin/locations/localities/[id]/approve  [admin]
 *
 * Approves a dealer-requested (pending) locality: sets status 'approved' and
 * generates a city-scoped unique slug IF one isn't already set (Section 15:
 * "Approve -> generate slug"). Seeded localities already carry a slug, so this
 * only mints one for the rare request that somehow lacks it. Then re-runs
 * automatic activation (it will still need introText >= 500 and 3+ listings to
 * actually go live).
 */
export const POST = withErrorHandling(
  async (
    _req: NextRequest,
    ctx: RouteContext<"/api/admin/locations/localities/[id]/approve">,
  ) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid locality id.");
    }

    await connectDB();
    const locality = await Locality.findById(id, {
      name: 1,
      slug: 1,
      cityId: 1,
      status: 1,
    }).lean();
    if (!locality) return fail("NOT_FOUND", "Locality not found.");

    const update: Record<string, unknown> = { status: "approved" };

    if (!locality.slug) {
      const existingSlugs = new Set(
        (await Locality.find({ cityId: locality.cityId }, { slug: 1 }).lean()).map(
          (l) => l.slug,
        ),
      );
      update.slug = generateLocalitySlug(locality.name, (s) => existingSlugs.has(s));
    }

    await Locality.updateOne({ _id: id }, { $set: update });

    const activation = await recalculateLocalityActivation(id);

    return ok({
      _id: id,
      status: "approved",
      slug: (update.slug as string | undefined) ?? locality.slug,
      activation,
    });
  },
);
