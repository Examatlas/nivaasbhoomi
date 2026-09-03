import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  activateCity,
  deactivateCity,
  canActivateCity,
  CityActivationError,
} from "@/lib/locations/activation";

const bodySchema = z.object({ active: z.boolean() });

/**
 * POST /api/admin/locations/cities/[id]/activate  [admin]
 *   body: { active: boolean }
 *
 * THE guarded activation endpoint. Activating enforces the Section 13 guard in
 * the service layer (activateCity throws if it fails), so a direct API call
 * cannot bypass it - it returns 422 with exactly what is missing. Deactivating
 * is always permitted (a manual admin decision).
 */
export const POST = withErrorHandling(
  async (
    req: NextRequest,
    ctx: RouteContext<"/api/admin/locations/cities/[id]/activate">,
  ) => {
    const auth = requireAdmin();
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
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Body must be { active: boolean }.");
    }

    if (!parsed.data.active) {
      await deactivateCity(id);
      return ok({ isActive: false });
    }

    try {
      const check = await activateCity(id);
      return ok({ isActive: true, activation: check });
    } catch (error) {
      if (error instanceof CityActivationError) {
        // Guard rejected the activation - report why, do not activate.
        return fail(
          "VALIDATION_ERROR",
          "City does not meet the activation requirements.",
          error.check,
        );
      }
      throw error;
    }
  },
);

/**
 * GET .../activate - convenience: current guard status without mutating.
 */
export const GET = withErrorHandling(
  async (
    _req: NextRequest,
    ctx: RouteContext<"/api/admin/locations/cities/[id]/activate">,
  ) => {
    const auth = requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid city id.");
    }
    return ok(await canActivateCity(id));
  },
);
