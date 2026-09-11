import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Staff } from "@/lib/db/models/Staff";
import { logAudit } from "@/lib/leads/assign";

/**
 * PATCH /api/admin/staff/[id]   [admin]   body: { action: "deactivate"|"activate" }
 *
 * Deactivating sets status "inactive" AND bumps tokenVersion — which invalidates
 * every live staff session immediately (requireStaff compares the token's `tv`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["deactivate", "activate"]) });

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/staff/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid staff id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "action must be deactivate or activate.");

    await connectDB();
    const staff = await Staff.findById(id);
    if (!staff) return fail("NOT_FOUND", "Staff not found.");

    if (parsed.data.action === "deactivate") {
      staff.status = "inactive";
      staff.tokenVersion = (staff.tokenVersion ?? 0) + 1; // kill all live sessions now
    } else {
      staff.status = "active";
    }
    await staff.save();

    await logAudit({
      action: "staff.deactivate",
      actor: { actorType: "admin", actorId: auth.identity.adminId },
      metadata: { staffId: String(staff._id), action: parsed.data.action },
    });

    return ok({ _id: String(staff._id), status: staff.status });
  },
);
