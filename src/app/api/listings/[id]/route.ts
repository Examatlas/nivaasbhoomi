import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { dealerListingRequestSchema } from "@/lib/listings/dealer-schema";
import {
  applyDealerInput,
  resolveSubmitStatus,
  mongooseFieldErrors,
} from "@/lib/listings/dealer-write";
import { revalidateListingPublicPaths } from "@/lib/listings/revalidate";

/**
 * PATCH  /api/listings/[id]   [dealer auth, owner]
 * DELETE /api/listings/[id]   [dealer auth, owner]   (DEV-SPEC.txt S13)
 *
 * Ownership: the listing must belong to the signed-in dealer (queried by
 * dealerId from the session). A dealer can never read or modify another
 * dealer's listing - a mismatch returns NOT_FOUND (no existence leak).
 */
async function ownedListing(id: string, dealerId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  return Listing.findOne({
    _id: id,
    dealerId: new mongoose.Types.ObjectId(dealerId),
    status: { $ne: "deleted" },
  });
}

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/listings/[id]">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = dealerListingRequestSchema.safeParse(json);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
    }
    const { submit, ...input } = parsed.data;

    const listing = await ownedListing(id, auth.identity.dealerId);
    if (!listing) return fail("NOT_FOUND", "Listing not found.");

    applyDealerInput(listing, input);

    if (submit) {
      // Only draft/rejected/expired listings can (re)enter review this way.
      const localityId = input.localityId ?? String(listing.localityId ?? "");
      listing.status = await resolveSubmitStatus(localityId);
    }

    try {
      await listing.save();
    } catch (err) {
      const fieldErrors = mongooseFieldErrors(err);
      if (fieldErrors) {
        return fail("VALIDATION_ERROR", "Please complete the required fields.", {
          fieldErrors,
        });
      }
      throw err;
    }

    // If the edited listing is live, refresh its public ISR pages so the change
    // shows at once. (Drafts/pending have no public page — skip to avoid churn
    // on every wizard autosave step.)
    if (listing.status === "approved") {
      await revalidateListingPublicPaths({
        slug: listing.slug,
        cityId: listing.cityId,
        localityId: listing.localityId,
      });
    }

    return ok({ id: String(listing._id), status: listing.status, slug: listing.slug ?? null });
  },
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/listings/[id]">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("NOT_FOUND", "Listing not found.");
    }
    await connectDB();
    // Soft delete via findOneAndUpdate so the model's submit-time validators
    // don't run on an incomplete draft being removed. Scoped by dealerId for
    // ownership. Returns the PRE-update doc so we know if it was live + its
    // slug/city/locality for cache invalidation.
    const prev = await Listing.findOneAndUpdate(
      {
        _id: id,
        dealerId: new mongoose.Types.ObjectId(auth.identity.dealerId),
        status: { $ne: "deleted" },
      },
      { $set: { status: "deleted" } },
      { projection: { status: 1, slug: 1, cityId: 1, localityId: 1 } },
    ).lean();
    if (!prev) return fail("NOT_FOUND", "Listing not found.");

    // If it was live, drop it from the ISR cache so the detail page 404s and its
    // card disappears from city/locality/home immediately.
    if (prev.status === "approved") {
      await revalidateListingPublicPaths({
        slug: prev.slug,
        cityId: prev.cityId,
        localityId: prev.localityId,
      });
    }
    return ok({ id, status: "deleted" });
  },
);
