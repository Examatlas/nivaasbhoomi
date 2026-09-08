import mongoose from "mongoose";

import { Lead } from "@/lib/db/models/Lead";

/**
 * The ONE shared quota primitive (STEP 3.3). Every path that would charge a
 * dealer for a lead — listing contact, agent profile, whatsapp-click — asks
 * hasRemainingQuota() and, when a dealer is full, parks the lead with
 * markQuotaUnassigned() instead of charging past the cap or wasting the lead.
 */

/** The unassignedReason value for a lead parked because its dealer is full. */
export const QUOTA_EXHAUSTED_REASON = "quota_exhausted" as const;

/** A dealer has room for one more lead this month. */
export function hasRemainingQuota(used: number, max: number): boolean {
  return (used ?? 0) < (max ?? 0);
}

/**
 * Park a still-unassigned lead because its intended dealer is over quota: keep
 * it (never waste it), leave assignedDealerId null, remember which dealer it was
 * for (intendedDealerId) so an admin can place it, and stamp the reason. Atomic
 * on assignedDealerId:null so it never clobbers a lead that got assigned first.
 */
export async function markQuotaUnassigned(
  leadId: mongoose.Types.ObjectId | string,
  intendedDealerId: mongoose.Types.ObjectId | string,
): Promise<void> {
  await Lead.updateOne(
    { _id: leadId, assignedDealerId: null },
    {
      $set: {
        status: "unassigned",
        intendedDealerId: new mongoose.Types.ObjectId(String(intendedDealerId)),
        unassignedReason: QUOTA_EXHAUSTED_REASON,
      },
    },
  );
}
