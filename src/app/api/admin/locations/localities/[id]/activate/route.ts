import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { recalculateLocalityActivation } from "@/lib/locations/activation";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/locations/localities/[id]/activate  [admin]  { active: boolean }
 *
 *   active:true  → RE-CHECK activation against the SEO rule (status approved +
 *                  introText ≥500 + ≥3 approved listings). It activates ONLY if
 *                  eligible and returns the reasons if not — so we never make a
 *                  locality "live" whose page would 404 (thin-page guard) or
 *                  create a broken city-page link.
 *   active:false → deactivate (manual admin override).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ active: z.boolean() });

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
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
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Body must be { active: boolean }.");

    await connectDB();

    if (parsed.data.active) {
      const result = await recalculateLocalityActivation(id);
      return ok(result); // { isActive, reasons, counts }
    }

    const res = await Locality.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { isActive: false } },
    );
    if (res.matchedCount === 0) return fail("NOT_FOUND", "Locality not found.");
    return ok({ isActive: false, reasons: [], counts: null });
  },
);
