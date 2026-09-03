import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { computeExpiresAt } from "@/lib/listings/derive";

/**
 * POST /api/listings/[id]/refresh   [dealer auth, owner]   (DEV-SPEC.txt S13)
 *
 * Resets the 30-day clock: lastRefreshedAt = now, expiresAt = +30 days. An
 * expired listing returns to 'approved'. Owner-scoped by session dealerId; uses
 * updateOne so the model's submit-time validators don't re-run on an otherwise
 * unchanged listing.
 */
export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/listings/[id]/refresh">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("NOT_FOUND", "Listing not found.");
    }
    await connectDB();

    const now = new Date();
    const listing = await Listing.findOne({
      _id: id,
      dealerId: new mongoose.Types.ObjectId(auth.identity.dealerId),
      status: { $in: ["approved", "expired"] },
    });
    if (!listing) {
      return fail("NOT_FOUND", "Listing not found, or not refreshable in its current state.");
    }

    await Listing.updateOne(
      { _id: listing._id },
      {
        $set: {
          lastRefreshedAt: now,
          expiresAt: computeExpiresAt(now),
          status: "approved",
        },
      },
    );

    return ok({ id, refreshedAt: now.toISOString(), status: "approved" });
  },
);
