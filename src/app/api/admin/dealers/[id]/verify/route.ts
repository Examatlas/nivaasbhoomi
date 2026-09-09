import type { NextRequest } from "next/server";
import { after } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";
import { notifyDealer } from "@/lib/notifications/dealer-events";

/** Pull a (now Tier-0) dealer's live listings back to 'pending' and recompute
 *  the affected localities/cities. Returns how many were unpublished. */
async function unpublishLiveListings(dealerId: string): Promise<number> {
  const live = await Listing.find(
    { dealerId, status: "approved" },
    { _id: 1, cityId: 1, localityId: 1 },
  ).lean();
  if (live.length === 0) return 0;

  await Listing.updateMany(
    { _id: { $in: live.map((l) => l._id) } },
    { $set: { status: "pending" } },
  );
  const cities = new Set(live.map((l) => String(l.cityId)).filter(Boolean));
  const localities = new Set(live.map((l) => String(l.localityId)).filter(Boolean));
  for (const l of localities) await recalculateLocalityActivation(l).catch(() => {});
  for (const c of cities) await recalculateCounters(c).catch(() => {});
  return live.length;
}

/**
 * POST /api/admin/dealers/[id]/verify   [admin]   (Sections 7, 13)
 *   body: { pan?, aadhaar?, gst?, udyam?, rera?, officePhoto?, notes? }
 *
 * Marks documents verified; the model recomputes verificationTier from them.
 * This is the minimal verification action needed so a dealer's listings can be
 * approved - full document review UI is Phase 6.
 */
const bodySchema = z.object({
  pan: z.boolean().optional(),
  aadhaar: z.boolean().optional(),
  gst: z.boolean().optional(),
  udyam: z.boolean().optional(),
  rera: z.boolean().optional(),
  officePhoto: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
  // Manual downgrade cap (Section 13): can only pull the tier DOWN, never above
  // what the verified documents earn. null clears the cap.
  override: z.number().int().min(0).max(4).nullable().optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]/verify">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid dealer id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid verification request.");
    }

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    // Tier BEFORE this action — used to detect the 0 → ≥1 "verified" crossing.
    const prevTier = dealer.verificationTier ?? 0;

    dealer.documents ??= {};
    for (const key of [
      "pan",
      "aadhaar",
      "gst",
      "udyam",
      "rera",
      "officePhoto",
    ] as const) {
      const val = parsed.data[key];
      if (val !== undefined) {
        dealer.documents[key] = { ...(dealer.documents[key] ?? {}), verified: val };
      }
    }
    if (parsed.data.notes !== undefined) dealer.verificationNotes = parsed.data.notes;
    if (parsed.data.override !== undefined) {
      dealer.verificationTierOverride = parsed.data.override;
    }
    dealer.verifiedAt = new Date();

    // The pre-validate hook recomputes verificationTier from the documents, then
    // applies the (downgrade-only) override cap.
    await dealer.save();

    // Enforce "Tier 0 dealer's listing NEVER goes live" (Section 13) on the
    // downgrade path: if the dealer is now Tier 0, pull any live listing back to
    // 'pending' and recalculate the affected localities/cities.
    let unpublished = 0;
    if ((dealer.verificationTier ?? 0) < 1) {
      unpublished = await unpublishLiveListings(String(dealer._id));
    }

    // Dealer just crossed Tier 0 → verified: notify them (best-effort, after the
    // response, so a WhatsApp hiccup never affects this action).
    if (prevTier < 1 && (dealer.verificationTier ?? 0) >= 1) {
      const dealerId = String(dealer._id);
      const dealerName = dealer.name;
      const dealerPhone = dealer.phone;
      after(() =>
        notifyDealer({
          event: "dealer_approved",
          dealerId,
          dealerName,
          dealerPhone,
          entityId: dealerId,
        }),
      );
    }

    return ok({
      _id: String(dealer._id),
      verificationTier: dealer.verificationTier,
      unpublishedListings: unpublished,
    });
  },
);
