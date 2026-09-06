import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { City } from "@/lib/db/models/City";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  recalculateLocalityActivation,
  LOCALITY_ACTIVATION,
} from "@/lib/locations/activation";

const faqSchema = z.array(
  z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) }),
);

const patchSchema = z.object({
  introText: z.string().trim().max(20000).optional(),
  connectivity: z.string().trim().max(5000).optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(400).optional(),
  faq: faqSchema.optional(),
});

/**
 * GET /api/admin/locations/localities/[id]  [admin]
 * Locality detail with the automatic-activation status so the admin can see why
 * a locality is or isn't live.
 */
export const GET = withErrorHandling(
  async (
    _req: NextRequest,
    ctx: RouteContext<"/api/admin/locations/localities/[id]">,
  ) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid locality id.");
    }

    await connectDB();
    const l = await Locality.findById(id).lean();
    if (!l) return fail("NOT_FOUND", "Locality not found.");

    const city = mongoose.isValidObjectId(l.cityId)
      ? await City.findById(l.cityId, { name: 1, slug: 1 }).lean()
      : null;
    const introTextChars = (l.introText ?? "").trim().length;

    return ok({
      _id: String(l._id),
      name: l.name,
      slug: l.slug,
      status: l.status,
      isActive: l.isActive,
      city: city ? { _id: String(city._id), name: city.name, slug: city.slug } : null,
      pincodes: l.pincodes ?? [],
      introText: l.introText ?? "",
      introTextChars,
      introTextRequired: LOCALITY_ACTIVATION.minIntroTextChars,
      connectivity: l.connectivity ?? "",
      metaTitle: l.metaTitle ?? "",
      metaDescription: l.metaDescription ?? "",
      faq: l.faq ?? [],
      listingCount: l.listingCount ?? 0,
    });
  },
);

/**
 * PATCH /api/admin/locations/localities/[id]  [admin]
 * Edit content (introText / connectivity / FAQ / meta). After a content edit we
 * re-run automatic activation, since crossing the 500-char introText threshold
 * can make an approved locality with enough listings go live.
 */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/locations/localities/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid locality id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid locality update.", parsed.error.flatten());
    }

    await connectDB();
    const exists = await Locality.exists({ _id: id });
    if (!exists) return fail("NOT_FOUND", "Locality not found.");

    await Locality.updateOne({ _id: id }, { $set: parsed.data });

    // Content change may flip isActive (automatic rule).
    const activation = await recalculateLocalityActivation(id);
    return ok({ activation });
  },
);
