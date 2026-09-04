import mongoose from "mongoose";

import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Lead } from "@/lib/db/models/Lead";
import type { ConversationDoc } from "@/lib/db/models/Conversation";

/**
 * Builders for the n8n payload (DEV-SPEC.txt Section 11): listingContext,
 * conversationHistory and existingLead.
 */

export interface ListingContext {
  title?: string;
  price?: number;
  bhk?: string;
  propertyType?: string;
  locality?: string;
  city?: string;
  area?: number;
  furnishing?: string;
  possessionStatus?: string;
  amenities?: string[];
}

/** The [Ref: <id>] tag the CTA embeds -> the listing's _id. */
export function parseListingRef(message: string): string | null {
  const m = message.match(/\[Ref:\s*([a-fA-F0-9]{24})\]/);
  return m ? m[1]! : null;
}

/** Public listing context for the AI, or null if the listing can't be resolved. */
export async function buildListingContext(
  listingId: string | null,
): Promise<ListingContext | null> {
  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) return null;
  const l = await Listing.findById(listingId).lean();
  if (!l) return null;

  const [city, locality] = await Promise.all([
    l.cityId ? City.findById(l.cityId, { name: 1 }).lean() : null,
    l.localityId ? Locality.findById(l.localityId, { name: 1 }).lean() : null,
  ]);

  return {
    title: l.title ?? undefined,
    price: (l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) ?? undefined,
    bhk: l.bhk ?? undefined,
    propertyType: l.propertyType ?? undefined,
    locality: locality?.name,
    city: city?.name,
    area: l.carpetArea ?? l.builtUpArea ?? l.plotArea ?? undefined,
    furnishing: l.furnishing ?? undefined,
    possessionStatus: l.possessionStatus ?? undefined,
    amenities: l.amenities ?? [],
  };
}

export interface HistoryMessage {
  direction: "in" | "out";
  type?: string;
  body?: string;
  timestamp?: string;
}

/** Last 10 messages of a conversation, oldest-first, for the AI context. */
export function conversationHistory(conv: ConversationDoc | null): HistoryMessage[] {
  if (!conv?.messages?.length) return [];
  return conv.messages.slice(-10).map((m) => ({
    direction: m.direction as "in" | "out",
    type: m.type ?? undefined,
    body: m.body ?? undefined,
    timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
  }));
}

/** The most recent non-terminal lead for a phone, as a plain object, or null. */
export async function findExistingLead(phone: string): Promise<Record<string, unknown> | null> {
  const lead = await Lead.findOne({
    phone,
    status: { $nin: ["converted", "lost"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  return (lead as Record<string, unknown> | null) ?? null;
}
