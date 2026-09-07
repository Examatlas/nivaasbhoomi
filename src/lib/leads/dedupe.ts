import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";

/**
 * The single lead-dedup rule, used by EVERY buyer-contact path (listing contact,
 * agent profile, WhatsApp click). A lead is a duplicate only for the SAME buyer,
 * SAME dealer and — for listing leads — the SAME listing, within 24 hours:
 *
 *   listing lead : phone + listingId  (a listing maps 1:1 to a dealer, so this
 *                  IS phone + dealerId + listingId)
 *   dealer lead  : phone + dealerId   (agent profile / dealer-only whatsapp)
 *
 * Different dealer or different listing is ALWAYS a separate lead. There is no
 * phone-only dedup anywhere anymore.
 */
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface DedupeOpts {
  phone: string;
  dealerId?: string | null;
  listingId?: string | null;
  /** Lead-magnet tools: dedup by phone + this source (e.g. "tool_stamp_duty")
   *  within the window — one lead per buyer per tool per 24h. */
  source?: string | null;
  windowMs?: number;
}

/** Pure: build the Mongo filter for a dedup lookup (null if nothing to key on). */
export function buildDedupeFilter(
  opts: DedupeOpts,
  now: Date = new Date(),
): Record<string, unknown> | null {
  const since = new Date(now.getTime() - (opts.windowMs ?? DEDUP_WINDOW_MS));
  const base: Record<string, unknown> = {
    phone: opts.phone,
    status: { $nin: ["converted", "lost"] },
    createdAt: { $gte: since },
  };
  if (opts.listingId && mongoose.Types.ObjectId.isValid(opts.listingId)) {
    base.listingId = new mongoose.Types.ObjectId(opts.listingId);
    return base;
  }
  if (opts.dealerId && mongoose.Types.ObjectId.isValid(opts.dealerId)) {
    base.assignedDealerId = new mongoose.Types.ObjectId(opts.dealerId);
    return base;
  }
  // Tool leads have neither a listing nor a dealer — key on the tool source.
  if (opts.source) {
    base.source = opts.source;
    return base;
  }
  return null;
}

/** Find a recent duplicate lead's id, or null. */
export async function findDuplicateLead(opts: DedupeOpts): Promise<string | null> {
  const filter = buildDedupeFilter(opts);
  if (!filter) return null;
  await connectDB();
  const existing = await Lead.findOne(filter, { _id: 1 }).sort({ createdAt: -1 }).lean();
  return existing ? String(existing._id) : null;
}
