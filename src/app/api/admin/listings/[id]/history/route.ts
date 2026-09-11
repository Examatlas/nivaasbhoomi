import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { AuditLog } from "@/lib/db/models/AuditLog";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * GET /api/admin/listings/[id]/history   [admin]
 *
 * The edit history for a listing — every "listing.edit" audit entry, newest
 * first, with who, when, and the per-field before/after captured in metadata.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Change {
  from: string;
  to: string;
}

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]/history">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid listing id.");

    await connectDB();
    const rows = await AuditLog.find(
      { listingId: new mongoose.Types.ObjectId(id), action: "listing.edit" },
      { actorType: 1, actorId: 1, metadata: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return ok(
      rows.map((r) => ({
        at: new Date(r.createdAt as Date).toISOString(),
        by: r.actorId ?? "—",
        actorType: r.actorType,
        changes: ((r.metadata as { changes?: Record<string, Change> } | undefined)?.changes) ?? {},
      })),
    );
  },
);
