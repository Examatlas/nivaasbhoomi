import type { NextRequest } from "next/server";
import { after } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";
import { notifyDealer } from "@/lib/notifications/dealer-events";

/**
 * POST /api/admin/listings/[id]/reject   [admin]   (Section 15)
 *   body: { reason }   - rejection reason is REQUIRED.
 *
 * Sets status 'rejected' and stores the reason. If the listing was previously
 * approved, the city/locality are recalculated so a rejected listing stops
 * counting toward activation.
 */
const bodySchema = z.object({
  reason: z.string().trim().min(3, "A rejection reason is required.").max(500),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]/reject">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid listing id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "A rejection reason is required.");
    }

    await connectDB();
    const listing = await Listing.findById(id);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    const wasApproved = listing.status === "approved";
    listing.status = "rejected";
    listing.rejectionReason = parsed.data.reason;
    await listing.save();

    if (wasApproved) {
      await Promise.all([
        recalculateCounters(listing.cityId!),
        recalculateLocalityActivation(listing.localityId!),
      ]);
    }

    // Notify the dealer with the reason (best-effort, after the response).
    const dealer = mongoose.isValidObjectId(listing.dealerId)
      ? await Dealer.findById(listing.dealerId, { name: 1, phone: 1 }).lean()
      : null;
    if (dealer) {
      const listingId = String(listing._id);
      const dealerId = String(dealer._id);
      const dealerName = dealer.name;
      const dealerPhone = dealer.phone;
      const listingTitle = listing.title;
      const reason = parsed.data.reason;
      after(() =>
        notifyDealer({
          event: "listing_rejected",
          dealerId,
          dealerName,
          dealerPhone,
          entityId: listingId,
          listingTitle,
          reason,
        }),
      );
    }

    return ok({ status: "rejected" });
  },
);
