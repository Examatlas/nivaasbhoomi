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
 * POST /api/listings   [dealer auth]   (DEV-SPEC.txt Sections 4, 7, 13)
 *   body: { ...listing fields, submit?: boolean }
 *
 * Creates the signed-in dealer's listing. `dealerId` is taken from the session,
 * never the client. `submit:false` saves a DRAFT (partial allowed); `submit:true`
 * files it for review - status 'pending' (or 'pending-location' if the locality
 * is still awaiting admin approval). slug / lastRefreshedAt / expiresAt (+30d)
 * are set by the model hook. All Section 13 rules are enforced by the model on a
 * non-draft save.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireDealer();
  if ("error" in auth) return auth.error;

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

  await connectDB();

  const listing = new Listing({
    dealerId: new mongoose.Types.ObjectId(auth.identity.dealerId),
    status: "draft",
  });
  applyDealerInput(listing, input);

  if (submit) {
    listing.status = await resolveSubmitStatus(input.localityId);
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

  return ok({
    id: String(listing._id),
    status: listing.status,
    slug: listing.slug ?? null,
  });
});
