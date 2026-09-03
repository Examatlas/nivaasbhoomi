import mongoose from "mongoose";

import { Locality } from "@/lib/db/models/Locality";
import type { DealerListingInput } from "@/lib/listings/dealer-schema";

/**
 * Shared write helpers for the dealer listing routes (DEV-SPEC.txt S13).
 */

interface ListingDocLike {
  set: (v: Record<string, unknown>) => void;
  propertyType?: string | null;
}

/**
 * Copy validated input onto a listing document. Plots can't carry bhk /
 * bathrooms / floor, so those are explicitly cleared when the type is (or
 * becomes) a plot - otherwise a leftover value would fail model validation.
 */
export function applyDealerInput(
  listing: ListingDocLike,
  input: DealerListingInput,
): void {
  listing.set({ ...input });
  const type = input.propertyType ?? listing.propertyType;
  if (type === "plot") {
    listing.set({ bhk: undefined, bathrooms: undefined, floor: undefined });
  }
}

/**
 * A submitted listing goes to 'pending' for admin review, or 'pending-location'
 * when its locality is still awaiting admin approval (a dealer-requested one).
 */
export async function resolveSubmitStatus(
  localityId: string | undefined,
): Promise<"pending" | "pending-location"> {
  if (!localityId || !mongoose.Types.ObjectId.isValid(localityId)) return "pending";
  const loc = await Locality.findById(localityId, { status: 1 }).lean();
  return loc && loc.status === "approved" ? "pending" : "pending-location";
}

/** Turn a Mongoose ValidationError into a { fieldErrors } map for the client. */
export function mongooseFieldErrors(err: unknown): Record<string, string> | null {
  if (
    !err ||
    typeof err !== "object" ||
    (err as { name?: string }).name !== "ValidationError"
  ) {
    return null;
  }
  const errors = (err as { errors?: Record<string, { message?: string }> }).errors ?? {};
  const out: Record<string, string> = {};
  for (const [path, e] of Object.entries(errors)) {
    out[path] = e?.message ?? "Invalid value.";
  }
  return out;
}
