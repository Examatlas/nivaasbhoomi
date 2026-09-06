import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { getDealerSession } from "@/lib/auth/middleware";
import { Lead } from "@/lib/db/models/Lead";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * A dealer's OWN leads (DEV-SPEC.txt Sections 7, 13). Every query is scoped to
 * assignedDealerId === the session dealer - a dealer can never read another
 * dealer's leads. The dealerId comes only from the verified JWT.
 */

export const LEAD_STATUSES = [
  "assigned",
  "contacted",
  "site-visit-scheduled",
  "site-visit-done",
  "converted",
  "lost",
] as const;
export type DealerEditableStatus = (typeof LEAD_STATUSES)[number];

export interface DealerLeadRow {
  id: string;
  buyerName: string;
  phone: string;
  purpose?: string;
  propertyType?: string;
  bhk?: string;
  budget?: string;
  timeline?: string;
  loanRequired?: boolean;
  qualificationScore?: number;
  status: string;
  /** listing | generic | ad | agent_profile — how the lead reached the dealer. */
  source: string;
  cityName?: string;
  localityName?: string;
  listing?: { id: string; title: string; slug?: string };
  dealerNotes?: string;
  assignedAt?: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

function budgetLabel(min?: number | null, max?: number | null): string | undefined {
  const unit = (n: number) =>
    n >= 1e7 ? `${(n / 1e7).toFixed(2).replace(/\.00$/, "")} Cr` : `${Math.round(n / 1e5)} L`;
  if (min && max) return `₹${unit(min)} – ₹${unit(max)}`;
  if (max) return `up to ₹${unit(max)}`;
  if (min) return `₹${unit(min)}+`;
  return undefined;
}

export interface DealerLeadsResult {
  rows: DealerLeadRow[];
  total: number;
  page: number;
  pageCount: number;
}

/** Paginated leads for the signed-in dealer, newest first, optional status filter. */
export async function getMyLeads(opts: {
  status?: string;
  page?: number;
}): Promise<DealerLeadsResult | null> {
  const session = await getDealerSession();
  if (!session) return null;
  await connectDB();

  const filter: Record<string, unknown> = {
    assignedDealerId: new mongoose.Types.ObjectId(session.dealerId),
  };
  if (opts.status && LEAD_STATUSES.includes(opts.status as DealerEditableStatus)) {
    filter.status = opts.status;
  }

  const page = Math.max(1, opts.page ?? 1);
  const total = await Lead.countDocuments(filter);
  const docs = await Lead.find(filter)
    .sort({ assignedAt: -1, createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const rows = await hydrate(docs);
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Count of the signed-in dealer's leads (for the dashboard). */
export async function getMyLeadCount(dealerId: string): Promise<number> {
  await connectDB();
  return Lead.countDocuments({
    assignedDealerId: new mongoose.Types.ObjectId(dealerId),
  });
}

/** Lead totals for the dashboard: total, still-active (not converted/lost), converted. */
export async function getMyLeadBreakdown(
  dealerId: string,
): Promise<{ total: number; active: number; converted: number }> {
  await connectDB();
  const filter = { assignedDealerId: new mongoose.Types.ObjectId(dealerId) };
  const [total, converted, closed] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.countDocuments({ ...filter, status: "converted" }),
    Lead.countDocuments({ ...filter, status: { $in: ["converted", "lost"] } }),
  ]);
  return { total, active: total - closed, converted };
}


async function hydrate(
  docs: Record<string, unknown>[],
): Promise<DealerLeadRow[]> {
  const cityIds = [...new Set(docs.map((d) => d.cityId).filter(Boolean).map(String))];
  const localityIds = [...new Set(docs.map((d) => d.localityId).filter(Boolean).map(String))];
  const listingIds = [...new Set(docs.map((d) => d.listingId).filter(Boolean).map(String))];

  const [cities, localities, listings] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
    Listing.find({ _id: { $in: listingIds } }, { title: 1, slug: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));

  return docs.map((d) => {
    const listing = d.listingId ? listingById.get(String(d.listingId)) : undefined;
    return {
      id: String(d._id),
      buyerName: (d.name as string) || (d.waProfileName as string) || "Unknown buyer",
      phone: String(d.phone),
      purpose: d.purpose as string | undefined,
      propertyType: d.propertyType as string | undefined,
      bhk: d.bhk as string | undefined,
      budget: budgetLabel(d.budgetMin as number, d.budgetMax as number),
      timeline: d.timeline as string | undefined,
      loanRequired: d.loanRequired as boolean | undefined,
      qualificationScore: d.qualificationScore as number | undefined,
      status: String(d.status),
      source: String(d.source ?? ""),
      cityName: d.cityId ? cityName.get(String(d.cityId)) : undefined,
      localityName: d.localityId ? localityName.get(String(d.localityId)) : undefined,
      listing: listing
        ? { id: String(listing._id), title: listing.title ?? "(untitled)", slug: listing.slug ?? undefined }
        : undefined,
      dealerNotes: d.dealerNotes as string | undefined,
      assignedAt: d.assignedAt ? new Date(d.assignedAt as Date).toISOString() : undefined,
      createdAt: new Date((d.createdAt as Date) ?? new Date()).toISOString(),
    };
  });
}

