import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { State } from "@/lib/db/models/State";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/locations/states/[id]/activate   [admin]   { active: boolean }
 *
 * Manually set a state's isActive flag. States normally auto-sync when their
 * cities are (de)activated (syncStateActivation); this is the admin override.
 * A state has no public page/guard, so activation is unconditional.
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
      return fail("VALIDATION_ERROR", "Invalid state id.");
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
    const res = await State.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { isActive: parsed.data.active } },
    );
    if (res.matchedCount === 0) return fail("NOT_FOUND", "State not found.");

    return ok({ isActive: parsed.data.active });
  },
);
