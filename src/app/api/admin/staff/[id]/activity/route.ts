import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { AuditLog } from "@/lib/db/models/AuditLog";

/**
 * GET /api/admin/staff/[id]/activity   [admin] — a staff member's audit trail
 * (everything they did: onboards, verifies, publishes, access requests).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/staff/[id]/activity">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid staff id.");

    await connectDB();
    const rows = await AuditLog.find(
      { actorType: "staff", actorId: id },
      { action: 1, dealerId: 1, listingId: 1, metadata: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return ok(
      rows.map((r) => ({
        at: new Date(r.createdAt as Date).toISOString(),
        action: r.action,
        dealerId: r.dealerId ? String(r.dealerId) : null,
        listingId: r.listingId ? String(r.listingId) : null,
        metadata: r.metadata ?? null,
      })),
    );
  },
);
