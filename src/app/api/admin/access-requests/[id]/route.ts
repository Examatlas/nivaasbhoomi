import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { AccessRequest } from "@/lib/db/models/AccessRequest";
import { logAudit } from "@/lib/leads/assign";

/**
 * PATCH /api/admin/access-requests/[id]   [admin]
 *   body: { action: "approve"|"reject", note? }
 *
 * Approving grants the staff a scoped view of that dealer (the scope query reads
 * approved requests). Only a pending request can be reviewed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/access-requests/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid request id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "action must be approve or reject.");

    await connectDB();
    const reqDoc = await AccessRequest.findById(id);
    if (!reqDoc) return fail("NOT_FOUND", "Access request not found.");
    if (reqDoc.status !== "pending") {
      return fail("VALIDATION_ERROR", "This request has already been reviewed.");
    }

    reqDoc.status = parsed.data.action === "approve" ? "approved" : "rejected";
    reqDoc.reviewedAt = new Date();
    reqDoc.reviewedBy = auth.identity.adminId;
    if (parsed.data.note) reqDoc.adminNote = parsed.data.note;
    await reqDoc.save();

    await logAudit({
      action: "access.review",
      actor: { actorType: "admin", actorId: auth.identity.adminId },
      dealerId: String(reqDoc.dealerId),
      metadata: {
        accessRequestId: String(reqDoc._id),
        staffId: String(reqDoc.staffId),
        decision: reqDoc.status,
      },
    });

    return ok({ _id: String(reqDoc._id), status: reqDoc.status });
  },
);
