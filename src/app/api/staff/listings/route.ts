import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireStaff } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { Locality } from "@/lib/db/models/Locality";
import { listingInputSchema } from "@/lib/listings/schema";
import { accessibleDealerIds, staffCanAccessDealer } from "@/lib/staff/scope";
import { revalidateListingPublicPaths } from "@/lib/listings/revalidate";
import { logAudit } from "@/lib/leads/assign";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";

/**
 * GET  /api/staff/listings   [staff] — listings for dealers in the staff's scope.
 * POST /api/staff/listings   [staff] — create AND publish a listing directly
 *   (no admin approval) for an accessible dealer. Publishing requires the dealer
 *   to be Tier 1+ ("a Tier-0 dealer's listing never goes live"). Audited.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  await connectDB();
  const dealerIds = await accessibleDealerIds(auth.identity.staffId);
  const rows = await Listing.find(
    { dealerId: { $in: dealerIds } },
    { title: 1, slug: 1, status: 1, dealerId: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return ok(
    rows.map((l) => ({
      _id: String(l._id),
      title: l.title,
      slug: l.slug ?? null,
      status: l.status,
      dealerId: String(l.dealerId),
    })),
  );
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = listingInputSchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Please fix the listing details.", parsed.error.flatten());
  }
  const data = parsed.data;

  // SCOPE: the dealer must be in this staff's scope (server-checked), regardless
  // of what dealerId the client sent.
  if (!(await staffCanAccessDealer(auth.identity.staffId, data.dealerId))) {
    return fail("NOT_FOUND", "Dealer not found.");
  }

  await connectDB();
  const [dealer, locality] = await Promise.all([
    Dealer.findById(data.dealerId, { verificationTier: 1 }).lean(),
    Locality.findById(data.localityId, { cityId: 1 }).lean(),
  ]);
  if (!dealer) return fail("VALIDATION_ERROR", "Selected dealer does not exist.");
  if (!locality) return fail("VALIDATION_ERROR", "Selected locality does not exist.");
  if (String(locality.cityId) !== data.cityId) {
    return fail("VALIDATION_ERROR", "Locality does not belong to the selected city.");
  }
  if ((dealer.verificationTier ?? 0) < 1) {
    return fail("VALIDATION_ERROR", "Verify the dealer (Tier 1+) before publishing the listing.");
  }

  try {
    const listing = await Listing.create({ ...data, status: "approved" }); // publish directly
    await Promise.all([
      recalculateCounters(listing.cityId!),
      recalculateLocalityActivation(listing.localityId!),
    ]);
    // Live immediately: invalidate the ISR cache for its public pages.
    await revalidateListingPublicPaths({
      slug: listing.slug,
      cityId: listing.cityId,
      localityId: listing.localityId,
    });
    await logAudit({
      action: "listing.publish",
      actor: { actorType: "staff", actorId: auth.identity.staffId },
      listingId: String(listing._id),
      dealerId: data.dealerId,
      metadata: { title: listing.title },
    });
    return ok({ _id: String(listing._id), slug: listing.slug, status: listing.status });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      const fields = Object.fromEntries(Object.entries(err.errors).map(([k, e]) => [k, [e.message]]));
      return fail("VALIDATION_ERROR", "Listing failed validation.", { fieldErrors: fields });
    }
    throw err;
  }
});
