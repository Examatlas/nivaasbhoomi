import type { NextRequest } from "next/server";
import { after } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";
import { revalidateListingPublicPaths } from "@/lib/listings/revalidate";
import { notifyDealer } from "@/lib/notifications/dealer-events";

/**
 * POST /api/admin/listings/[id]/approve   [admin]   (Sections 13, 15)
 *
 * pending / pending-location / expired -> approved. Blocks approval of a Tier-0
 * dealer's listing ("Tier 0 dealer ki listing NEVER goes live"). On success,
 * refreshes the city counters and the locality's automatic activation, so a
 * locality can flip live once it has 3+ approved listings and 500+ char intro.
 */
export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]/approve">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid listing id.");
    }

    await connectDB();
    const listing = await Listing.findById(id);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    if (listing.status === "deleted") {
      return fail("VALIDATION_ERROR", "A deleted listing cannot be approved.");
    }

    const dealer = mongoose.isValidObjectId(listing.dealerId)
      ? await Dealer.findById(listing.dealerId, { verificationTier: 1, name: 1, phone: 1 }).lean()
      : null;
    if (!dealer || (dealer.verificationTier ?? 0) < 1) {
      return fail(
        "VALIDATION_ERROR",
        "The owning dealer is Tier 0 (unverified). Verify the dealer before this listing can go live.",
      );
    }

    listing.status = "approved";
    await listing.save();

    // Section 13: recalculate the affected city and locality on approve.
    const [counters, localityActivation] = await Promise.all([
      recalculateCounters(listing.cityId!),
      recalculateLocalityActivation(listing.localityId!),
    ]);

    // Going live: invalidate the ISR cache for this listing's public pages so
    // the detail page (and its city/locality/home cards) reflect it at once —
    // clears any stale notFound() cached while it was pending.
    await revalidateListingPublicPaths({
      slug: listing.slug,
      cityId: listing.cityId,
      localityId: listing.localityId,
    });

    // Notify the dealer their listing is live (best-effort, after the response).
    const listingId = String(listing._id);
    const dealerId = String(dealer._id);
    const dealerName = dealer.name;
    const dealerPhone = dealer.phone;
    const listingTitle = listing.title;
    const listingSlug = listing.slug;
    after(() =>
      notifyDealer({
        event: "listing_approved",
        dealerId,
        dealerName,
        dealerPhone,
        entityId: listingId,
        listingTitle,
        listingSlug,
      }),
    );

    return ok({ status: "approved", counters, localityActivation });
  },
);
