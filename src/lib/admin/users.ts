import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { Lead } from "@/lib/db/models/Lead";
import { Listing } from "@/lib/db/models/Listing";
import { tierName } from "@/lib/dealers/account";

/**
 * Admin "Users" views: everyone who signed up — buyers (User) and dealers
 * (Dealer) — with activity counts, searchable + server-paginated.
 *
 * SECURITY: passwordHash is NEVER selected or returned. Every projection here is
 * an explicit allow-list, so a hash can't leak into the UI or any response.
 */

export const PAGE_SIZE = 25;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

// ---------- Buyers (User) ----------

export interface AdminBuyerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  enquiryCount: number;
}

export async function listBuyers(opts: {
  q?: string;
  page?: number;
}): Promise<Paged<AdminBuyerRow>> {
  await connectDB();
  const page = Math.max(1, opts.page ?? 1);

  const filter: Record<string, unknown> = {};
  if (opts.q?.trim()) {
    const rx = new RegExp(escapeRegex(opts.q.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter, { name: 1, email: 1, phone: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  // Enquiry counts: a buyer's leads are matched by phone (one aggregate query).
  const phones = users.map((u) => u.phone).filter(Boolean);
  const counts = phones.length
    ? await Lead.aggregate<{ _id: string; n: number }>([
        { $match: { phone: { $in: phones } } },
        { $group: { _id: "$phone", n: { $sum: 1 } } },
      ])
    : [];
  const byPhone = new Map(counts.map((c) => [c._id, c.n]));

  return {
    rows: users.map((u) => ({
      id: String(u._id),
      name: u.name ?? "—",
      email: u.email ?? "—",
      phone: u.phone,
      createdAt: (u.createdAt ?? new Date()).toISOString(),
      enquiryCount: byPhone.get(u.phone) ?? 0,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export interface AdminBuyerDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  lastLoginAt: string | null;
  enquiries: {
    id: string;
    createdAt: string;
    status: string;
    source: string;
    listingTitle: string | null;
    listingSlug: string | null;
  }[];
}

export async function getBuyerDetail(id: string): Promise<AdminBuyerDetail | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();

  const u = await User.findById(id, {
    name: 1,
    email: 1,
    phone: 1,
    createdAt: 1,
    lastLoginAt: 1,
  }).lean();
  if (!u) return null;

  const leads = await Lead.find(
    { phone: u.phone },
    { status: 1, source: 1, listingId: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const listingIds = leads.map((l) => l.listingId).filter(Boolean) as mongoose.Types.ObjectId[];
  const listings = listingIds.length
    ? await Listing.find({ _id: { $in: listingIds } }, { title: 1, slug: 1 }).lean()
    : [];
  const byId = new Map(listings.map((l) => [String(l._id), l]));

  return {
    id: String(u._id),
    name: u.name ?? "—",
    email: u.email ?? "—",
    phone: u.phone,
    createdAt: (u.createdAt ?? new Date()).toISOString(),
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    enquiries: leads.map((l) => {
      const listing = l.listingId ? byId.get(String(l.listingId)) : null;
      return {
        id: String(l._id),
        createdAt: (l.createdAt ?? new Date()).toISOString(),
        status: l.status as string,
        source: l.source as string,
        listingTitle: listing?.title ?? null,
        listingSlug: listing?.slug ?? null,
      };
    }),
  };
}

// ---------- Dealers (as a signed-up-users view) ----------

export interface AdminDealerUserRow {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  tier: number;
  tierLabel: string;
  status: string;
  listingCount: number;
  leadCount: number;
  createdAt: string;
}

export async function listDealerUsers(opts: {
  q?: string;
  page?: number;
}): Promise<Paged<AdminDealerUserRow>> {
  await connectDB();
  const page = Math.max(1, opts.page ?? 1);

  const filter: Record<string, unknown> = {};
  if (opts.q?.trim()) {
    const rx = new RegExp(escapeRegex(opts.q.trim()), "i");
    filter.$or = [{ businessName: rx }, { name: rx }, { email: rx }, { phone: rx }];
  }

  const total = await Dealer.countDocuments(filter);
  const dealers = await Dealer.find(filter, {
    name: 1,
    businessName: 1,
    email: 1,
    phone: 1,
    verificationTier: 1,
    status: 1,
    createdAt: 1,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const ids = dealers.map((d) => d._id);
  const [listingCounts, leadCounts] = ids.length
    ? await Promise.all([
        Listing.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { dealerId: { $in: ids }, status: { $ne: "deleted" } } },
          { $group: { _id: "$dealerId", n: { $sum: 1 } } },
        ]),
        Lead.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { assignedDealerId: { $in: ids } } },
          { $group: { _id: "$assignedDealerId", n: { $sum: 1 } } },
        ]),
      ])
    : [[], []];
  const listingBy = new Map(listingCounts.map((c) => [String(c._id), c.n]));
  const leadBy = new Map(leadCounts.map((c) => [String(c._id), c.n]));

  return {
    rows: dealers.map((d) => ({
      id: String(d._id),
      name: d.name,
      businessName: d.businessName,
      email: d.email ?? "—",
      phone: d.phone,
      tier: d.verificationTier ?? 0,
      tierLabel: tierName(d.verificationTier ?? 0),
      status: d.status as string,
      listingCount: listingBy.get(String(d._id)) ?? 0,
      leadCount: leadBy.get(String(d._id)) ?? 0,
      createdAt: (d.createdAt ?? new Date()).toISOString(),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ---------- Dealer activity (for the dealer detail page) ----------

export interface DealerActivity {
  listings: {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    createdAt: string;
  }[];
  leads: {
    id: string;
    name: string;
    phone: string;
    status: string;
    createdAt: string;
  }[];
  totalListings: number;
  totalLeads: number;
}

export async function getDealerActivity(id: string): Promise<DealerActivity | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const dealerId = new mongoose.Types.ObjectId(id);

  const [listings, leads, totalListings, totalLeads] = await Promise.all([
    Listing.find({ dealerId }, { title: 1, slug: 1, status: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Lead.find({ assignedDealerId: dealerId }, { name: 1, phone: 1, status: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Listing.countDocuments({ dealerId }),
    Lead.countDocuments({ assignedDealerId: dealerId }),
  ]);

  return {
    listings: listings.map((l) => ({
      id: String(l._id),
      title: l.title ?? "(untitled)",
      slug: l.slug ?? null,
      status: l.status as string,
      createdAt: (l.createdAt ?? new Date()).toISOString(),
    })),
    leads: leads.map((l) => ({
      id: String(l._id),
      name: l.name ?? "—",
      phone: l.phone,
      status: l.status as string,
      createdAt: (l.createdAt ?? new Date()).toISOString(),
    })),
    totalListings,
    totalLeads,
  };
}
