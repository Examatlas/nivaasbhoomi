import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Locality } from "@/lib/db/models/Locality";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";

/**
 * POST /api/admin/locations/localities/[id]/reject  [admin]
 *
 * Rejects a dealer-requested locality. The Locality status enum is only
 * ['approved','pending'] (Section 4) - there is no 'rejected' state - so a
 * rejection DELETES the pending locality. Guards:
 *   - only pending localities can be rejected (an approved, live place is not
 *     deleted through this route),
 *   - refuse if any listing already references it, so we never orphan a listing
 *     that linked to it while it was pending-location.
 */
export const POST = withErrorHandling(
  async (
    _req: NextRequest,
    ctx: RouteContext<"/api/admin/locations/localities/[id]/reject">,
  ) => {
    const auth = requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid locality id.");
    }

    await connectDB();
    const locality = await Locality.findById(id, { status: 1 }).lean();
    if (!locality) return fail("NOT_FOUND", "Locality not found.");
    if (locality.status !== "pending") {
      return fail("VALIDATION_ERROR", "Only pending localities can be rejected.");
    }

    const _id = new mongoose.Types.ObjectId(id);
    const db = mongoose.connection.db;
    const referencing = db
      ? await db.collection("listings").countDocuments({ localityId: _id })
      : 0;
    if (referencing > 0) {
      return fail(
        "VALIDATION_ERROR",
        `Cannot reject: ${referencing} listing(s) reference this locality.`,
      );
    }

    await Locality.deleteOne({ _id });
    return ok({ _id: id, deleted: true });
  },
);
