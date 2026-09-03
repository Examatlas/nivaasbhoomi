import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { State } from "@/lib/db/models/State";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { canActivateCity } from "@/lib/locations/activation";

const faqSchema = z.array(
  z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) }),
);

const patchSchema = z.object({
  introText: z.string().trim().max(20000).optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(400).optional(),
  faq: faqSchema.optional(),
});

/**
 * GET /api/admin/locations/cities/[id]  [admin]
 * City detail with editable SEO fields, current counters, and a LIVE activation
 * check so the UI shows exactly what is missing.
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/locations/cities/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid city id.");
    }

    await connectDB();
    const city = await City.findById(id).lean();
    if (!city) return fail("NOT_FOUND", "City not found.");

    const state = await State.findById(city.stateId, { name: 1, slug: 1 }).lean();
    const activation = await canActivateCity(id);

    return ok({
      _id: String(city._id),
      name: city.name,
      slug: city.slug,
      tier: city.tier,
      isActive: city.isActive,
      state: state
        ? { _id: String(state._id), name: state.name, slug: state.slug }
        : null,
      introText: city.introText ?? "",
      metaTitle: city.metaTitle ?? "",
      metaDescription: city.metaDescription ?? "",
      faq: city.faq ?? [],
      counters: {
        listingCount: city.listingCount ?? 0,
        dealerCount: city.dealerCount ?? 0,
        localityCount: city.localityCount ?? 0,
      },
      activation,
    });
  },
);

/**
 * PATCH /api/admin/locations/cities/[id]  [admin]
 * Edit SEO content (introText / metaTitle / metaDescription / FAQ). Never
 * touches slug (immutable) or isActive (guarded via the activate route).
 */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/locations/cities/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid city id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid city update.", parsed.error.flatten());
    }

    await connectDB();
    const updated = await City.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      {
        new: true,
        projection: { introText: 1, metaTitle: 1, metaDescription: 1, faq: 1 },
      },
    ).lean();
    if (!updated) return fail("NOT_FOUND", "City not found.");

    return ok({
      introText: updated.introText ?? "",
      metaTitle: updated.metaTitle ?? "",
      metaDescription: updated.metaDescription ?? "",
      faq: updated.faq ?? [],
    });
  },
);
