import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { AccessRequest } from "@/lib/db/models/AccessRequest";

/**
 * Staff scoping — the single source of truth for "which dealers can this staff
 * see/act on". A staff's scope = the dealers they ONBOARDED ∪ dealers granted
 * via an APPROVED AccessRequest. Scope is ALWAYS derived here from the session's
 * staffId — never from client input — so no URL-supplied dealerId can widen it.
 */

/** Dealer ids granted to a staff via approved access requests. */
async function grantedDealerIds(staffId: string): Promise<mongoose.Types.ObjectId[]> {
  const rows = await AccessRequest.find(
    { staffId: new mongoose.Types.ObjectId(staffId), status: "approved" },
    { dealerId: 1 },
  ).lean();
  return rows.map((r) => r.dealerId as mongoose.Types.ObjectId);
}

/**
 * A Mongo filter that restricts a Dealer query to a staff's scope. Combine with
 * other conditions via $and (callers merge it), or spread as the base filter.
 */
export async function staffDealerFilter(staffId: string): Promise<Record<string, unknown>> {
  await connectDB();
  const granted = await grantedDealerIds(staffId);
  const staffOid = new mongoose.Types.ObjectId(staffId);
  return { $or: [{ onboardedBy: staffOid }, { _id: { $in: granted } }] };
}

/** All dealer ids in a staff's scope (for scoping Listing queries by dealerId). */
export async function accessibleDealerIds(staffId: string): Promise<mongoose.Types.ObjectId[]> {
  await connectDB();
  const staffOid = new mongoose.Types.ObjectId(staffId);
  const [onboarded, granted] = await Promise.all([
    Dealer.find({ onboardedBy: staffOid }, { _id: 1 }).lean(),
    grantedDealerIds(staffId),
  ]);
  const ids = new Map<string, mongoose.Types.ObjectId>();
  for (const d of onboarded) ids.set(String(d._id), d._id as mongoose.Types.ObjectId);
  for (const id of granted) ids.set(String(id), id);
  return [...ids.values()];
}

/**
 * THE choke-point: may this staff act on this dealer? True iff the dealer is in
 * the staff's scope. Every staff route that takes a dealerId (or a listing whose
 * dealer must be checked) calls this before touching the record.
 */
export async function staffCanAccessDealer(staffId: string, dealerId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(dealerId)) return false;
  await connectDB();
  const staffOid = new mongoose.Types.ObjectId(staffId);
  const dealerOid = new mongoose.Types.ObjectId(dealerId);
  const owned = await Dealer.exists({ _id: dealerOid, onboardedBy: staffOid });
  if (owned) return true;
  const granted = await AccessRequest.exists({
    staffId: staffOid,
    dealerId: dealerOid,
    status: "approved",
  });
  return Boolean(granted);
}
