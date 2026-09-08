import mongoose from "mongoose";

import { Listing } from "@/lib/db/models/Listing";

/**
 * Seed (display-only) listings must NEVER produce a lead — enforced server-side,
 * not just hidden in the UI. Every listing-based lead path checks this.
 */
export const SEED_CONTACT_BLOCKED_MESSAGE =
  "This property is still in verification and can't be contacted yet.";

export async function isSeedListing(listingId: string | null | undefined): Promise<boolean> {
  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) return false;
  const doc = await Listing.exists({ _id: listingId, isSeed: true });
  return Boolean(doc);
}
