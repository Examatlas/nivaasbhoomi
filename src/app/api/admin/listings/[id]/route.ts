import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { State } from "@/lib/db/models/State";
import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { listingInputSchema } from "@/lib/listings/schema";
import {
  recalculateCounters,
  recalculateLocalityActivation,
} from "@/lib/locations/activation";

/**
 * GET   /api/admin/listings/[id]   [admin] - full detail incl. dealer + tier.
 * PATCH /api/admin/listings/[id]   [admin] - edit fields (slug is never touched).
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid listing id.");
    }

    await connectDB();
    const l = await Listing.findById(id).lean();
    if (!l) return fail("NOT_FOUND", "Listing not found.");

    const [dealer, city, locality, state] = await Promise.all([
      Dealer.findById(l.dealerId, {
        name: 1,
        businessName: 1,
        phone: 1,
        verificationTier: 1,
        rating: 1,
        ratingCount: 1,
        status: 1,
      }).lean(),
      City.findById(l.cityId, { name: 1, slug: 1 }).lean(),
      Locality.findById(l.localityId, { name: 1, slug: 1, status: 1 }).lean(),
      l.stateId ? State.findById(l.stateId, { name: 1 }).lean() : null,
    ]);

    // Admin sees full listing (incl. fullAddress and dealer phone) - the privacy
    // rules restrict PUBLIC exposure, not the admin console.
    return ok({
      ...l,
      _id: String(l._id),
      dealerId: String(l.dealerId),
      cityId: String(l.cityId),
      localityId: String(l.localityId),
      stateId: l.stateId ? String(l.stateId) : null,
      dealer: dealer
        ? {
            _id: String(dealer._id),
            name: dealer.name,
            businessName: dealer.businessName,
            phone: dealer.phone,
            verificationTier: dealer.verificationTier ?? 0,
            rating: dealer.rating ?? 0,
            ratingCount: dealer.ratingCount ?? 0,
            status: dealer.status,
          }
        : null,
      city: city ? { _id: String(city._id), name: city.name, slug: city.slug } : null,
      locality: locality
        ? { _id: String(locality._id), name: locality.name, slug: locality.slug }
        : null,
      state: state ? { name: state.name } : null,
    });
  },
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/listings/[id]">) => {
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
    const parsed = listingInputSchema.safeParse(json);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the listing details.",
        parsed.error.flatten(),
      );
    }

    await connectDB();
    const listing = await Listing.findById(id);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    // Assign editable fields; slug/lastRefreshedAt/expiresAt are managed by the
    // model and never overwritten here.
    const { status: _status, ...fields } = parsed.data;
    Object.assign(listing, fields);

    try {
      await listing.save();
    } catch (err) {
      if (err instanceof mongoose.Error.ValidationError) {
        const fieldErrors = Object.fromEntries(
          Object.entries(err.errors).map(([k, e]) => [k, [e.message]]),
        );
        return fail("VALIDATION_ERROR", "Listing failed validation.", { fieldErrors });
      }
      throw err;
    }

    // If the listing is live, its edited fields may change counters/activation.
    if (listing.status === "approved") {
      await Promise.all([
        recalculateCounters(listing.cityId!),
        recalculateLocalityActivation(listing.localityId!),
      ]);
    }

    return ok({ _id: String(listing._id) });
  },
);
