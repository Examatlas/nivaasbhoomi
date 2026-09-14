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
import { revalidateListingPublicPaths } from "@/lib/listings/revalidate";
import { notifyDealer } from "@/lib/notifications/dealer-events";
import { buildRejectReason, REJECT_REASON_VALUES } from "@/lib/listings/reject-reasons";

/**
 * POST /api/admin/listings/[id]/reject   [admin]   (Section 15)
 *   body: { reasons?: string[], note?: string }
 *
 * Structured rejection: the admin picks one or more reason checkboxes and/or a
 * free-text note. At least one is required. The selected reason labels + note
 * are joined into ONE full reason string, stored UNTRUNCATED on the listing; the
 * WhatsApp copy is truncated to 200 chars downstream (sanitizeTemplateParam).
 * If the listing was previously approved, the city/locality are recalculated.
 */
const bodySchema = z.object({
  reasons: z.array(z.string()).max(20).optional(),
  note: z.string().trim().max(1000).optional(),
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
      return fail("VALIDATION_ERROR", "Invalid rejection request.");
    }

    // Keep only known reason values; require at least one reason OR a note.
    const reasons = (parsed.data.reasons ?? []).filter((v) => REJECT_REASON_VALUES.includes(v));
    const note = parsed.data.note ?? "";
    if (reasons.length === 0 && !note.trim()) {
      return fail("VALIDATION_ERROR", "Select at least one reason or add a note.");
    }
    const fullReason = buildRejectReason(reasons, note);

    await connectDB();
    const listing = await Listing.findById(id);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    const wasApproved = listing.status === "approved";
    listing.status = "rejected";
    // Full reason stored untruncated; only the WhatsApp copy is truncated.
    listing.rejectionReason = fullReason;
    await listing.save();

    if (wasApproved) {
      await Promise.all([
        recalculateCounters(listing.cityId!),
        recalculateLocalityActivation(listing.localityId!),
      ]);
      // Was live, now unpublished: drop it from the ISR cache so the detail page
      // 404s and its card disappears from city/locality/home immediately.
      await revalidateListingPublicPaths({
        slug: listing.slug,
        cityId: listing.cityId,
        localityId: listing.localityId,
      });
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
      const reason = fullReason; // notifyDealer truncates for WhatsApp
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
