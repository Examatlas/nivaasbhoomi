import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Dealer-scoped property search for the Agent API. EVERY query is filtered by
 * dealerId (from the authenticated key, never client input), status "approved"
 * (the only publicly-visible state), and isSeed:{$ne:true} — seed listings are
 * NEVER exposed. No buyer PII is ever touched.
 */

export const AGENT_SEARCH_DEFAULT_LIMIT = 10;
export const AGENT_SEARCH_MAX_LIMIT = 25;

export interface AgentSearchParams {
  city?: string; // city slug
  locality?: string; // locality slug (within the city)
  type?: string; // propertyType
  purpose?: "sale" | "rent";
  budgetMin?: number;
  budgetMax?: number;
  bhk?: string;
  listingId?: string;
  limit?: number;
  cursor?: string; // an ObjectId string (paginate by _id, newest first)
}

export interface AgentListing {
  id: string;
  title: string;
  publicUrl: string;
  price: number | null;
  city: string;
  locality: string;
  type: string;
  purpose: string;
  bhk: string | null;
  area: number | null;
  areaUnit: string;
  description: string;
  imageUrl: string | null;
  status: string;
  updatedAt: string;
}

export interface AgentSearchResult {
  items: AgentListing[];
  nextCursor: string | null;
}

function pickArea(l: Record<string, unknown>): number | null {
  return (
    (l.carpetArea as number) ??
    (l.builtUpArea as number) ??
    (l.superBuiltUpArea as number) ??
    (l.plotArea as number) ??
    null
  );
}

function shape(
  l: Record<string, unknown> & { _id: unknown; photos?: { url?: string }[]; coverPhotoIndex?: number },
  cityName: string,
  localityName: string,
  full: boolean,
): AgentListing {
  const photos = (l.photos as { url?: string }[]) ?? [];
  const cover = photos[(l.coverPhotoIndex as number) ?? 0] ?? photos[0];
  const desc = ((l.description as string) ?? "").trim();
  return {
    id: String(l._id),
    title: (l.title as string) ?? "",
    publicUrl: absoluteUrl(`/property/${l.slug as string}`),
    price: ((l.purpose === "rent" ? l.monthlyRent : l.expectedPrice) as number) ?? null,
    city: cityName,
    locality: localityName,
    type: (l.propertyType as string) ?? "",
    purpose: (l.purpose as string) ?? "",
    bhk: (l.bhk as string) ?? null,
    area: pickArea(l),
    areaUnit: "sq.ft.",
    description: full ? desc : desc.length > 240 ? `${desc.slice(0, 240)}…` : desc,
    imageUrl: cover?.url ?? null,
    status: (l.status as string) ?? "",
    updatedAt: ((l.updatedAt as Date) ?? (l.createdAt as Date) ?? new Date()).toISOString(),
  };
}

const PROJECTION = {
  title: 1,
  slug: 1,
  purpose: 1,
  propertyType: 1,
  bhk: 1,
  carpetArea: 1,
  builtUpArea: 1,
  superBuiltUpArea: 1,
  plotArea: 1,
  expectedPrice: 1,
  monthlyRent: 1,
  description: 1,
  photos: 1,
  coverPhotoIndex: 1,
  status: 1,
  cityId: 1,
  localityId: 1,
  updatedAt: 1,
  createdAt: 1,
} as const;

async function names(cityIds: string[], localityIds: string[]) {
  const [cities, localities] = await Promise.all([
    City.find({ _id: { $in: cityIds.map((id) => new mongoose.Types.ObjectId(id)) } }, { name: 1 }).lean(),
    Locality.find(
      { _id: { $in: localityIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { name: 1 },
    ).lean(),
  ]);
  return {
    city: new Map(cities.map((c) => [String(c._id), c.name])),
    locality: new Map(localities.map((l) => [String(l._id), l.name])),
  };
}

export async function agentSearch(
  dealerId: string,
  params: AgentSearchParams,
): Promise<AgentSearchResult> {
  await connectDB();

  // dealerId + only publicly-visible, never-seed listings. ALWAYS server-set.
  const base: Record<string, unknown> = {
    dealerId: new mongoose.Types.ObjectId(dealerId),
    status: "approved",
    isSeed: { $ne: true },
  };

  // Single-listing detail: it must belong to THIS dealer (base filter) — a
  // cross-dealer or seed id simply returns empty.
  if (params.listingId) {
    if (!mongoose.Types.ObjectId.isValid(params.listingId)) return { items: [], nextCursor: null };
    const l = await Listing.findOne(
      { ...base, _id: new mongoose.Types.ObjectId(params.listingId) },
      PROJECTION,
    ).lean();
    if (!l) return { items: [], nextCursor: null };
    const n = await names([String(l.cityId)], [String(l.localityId)]);
    return {
      items: [shape(l as never, n.city.get(String(l.cityId)) ?? "", n.locality.get(String(l.localityId)) ?? "", true)],
      nextCursor: null,
    };
  }

  // Resolve city/locality SLUGS → ids. An unknown slug yields no matches.
  if (params.city) {
    const city = await City.findOne({ slug: params.city.toLowerCase() }, { _id: 1 }).lean();
    if (!city) return { items: [], nextCursor: null };
    base.cityId = city._id;
    if (params.locality) {
      const loc = await Locality.findOne(
        { cityId: city._id, slug: params.locality.toLowerCase() },
        { _id: 1 },
      ).lean();
      if (!loc) return { items: [], nextCursor: null };
      base.localityId = loc._id;
    }
  }

  if (params.type) base.propertyType = params.type;
  if (params.purpose) base.purpose = params.purpose;
  if (params.bhk) base.bhk = params.bhk;

  const priceField = params.purpose === "rent" ? "monthlyRent" : "expectedPrice";
  if (params.budgetMin != null || params.budgetMax != null) {
    base[priceField] = {
      ...(params.budgetMin != null ? { $gte: params.budgetMin } : {}),
      ...(params.budgetMax != null ? { $lte: params.budgetMax } : {}),
    };
  }

  if (params.cursor && mongoose.Types.ObjectId.isValid(params.cursor)) {
    base._id = { $lt: new mongoose.Types.ObjectId(params.cursor) };
  }

  const limit = Math.min(
    Math.max(1, params.limit ?? AGENT_SEARCH_DEFAULT_LIMIT),
    AGENT_SEARCH_MAX_LIMIT,
  );

  const rows = await Listing.find(base, PROJECTION)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const n = await names(
    [...new Set(page.map((r) => String(r.cityId)))],
    [...new Set(page.map((r) => String(r.localityId)))],
  );
  const items = page.map((l) =>
    shape(l as never, n.city.get(String(l.cityId)) ?? "", n.locality.get(String(l.localityId)) ?? "", false),
  );
  const nextCursor = hasMore ? String(page[page.length - 1]!._id) : null;
  return { items, nextCursor };
}
