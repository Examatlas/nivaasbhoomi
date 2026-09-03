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
    // Soft delete via updateOne so the model's submit-time validators don't run
    // on an incomplete draft being removed. Scoped by dealerId for ownership.
    const res = await Listing.updateOne(
      {
        _id: id,
        dealerId: new mongoose.Types.ObjectId(auth.identity.dealerId),
        status: { $ne: "deleted" },
      },
      { $set: { status: "deleted" } },
    );
    if (res.matchedCount === 0) return fail("NOT_FOUND", "Listing not found.");
    return ok({ id, status: "deleted" });
  },
);
