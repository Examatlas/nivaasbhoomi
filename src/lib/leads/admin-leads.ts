import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Lead } from "@/lib/db/models/Lead";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Conversation } from "@/lib/db/models/Conversation";
import { AuditLog } from "@/lib/db/models/AuditLog";

/**
 * Admin lead views (DEV-SPEC.txt Sections 12, 15): the unmatched/quota queue
 * grouped by city (the sales signal), a full searchable list, and a lead detail
 * with its WhatsApp conversation + audit trail.
 */

function budgetLabel(min?: number | null, max?: number | null): string | undefined {
  const unit = (n: number) =>
    n >= 1e7 ? `${(n / 1e7).toFixed(2).replace(/\.00$/, "")} Cr` : `${Math.round(n / 1e5)} L`;
  if (min && max) return `₹${unit(min)} – ₹${unit(max)}`;
  if (max) return `up to ₹${unit(max)}`;
  if (min) return `₹${unit(min)}+`;
  return undefined;
}

export interface AdminLeadRow {
  id: string;
  buyerName: string;
  phone: string;
  status: string;
  source: string;
  reason: string;
  purpose?: string;
  bhk?: string;
  budget?: string;
  timeline?: string;
  qualificationScore?: number;
  cityId?: string;
  cityName?: string;
  localityName?: string;
  listing?: { id: string; title: string };
  assignedDealer?: { id: string; businessName: string };
  createdAt: string;
}

function reasonFor(status: string, source: string): string {
  if (status === "quota-exceeded") return "Listing owner is over their monthly quota";
  if (status === "unmatched") {
    return source === "listing"
      ? "Listing owner unavailable (paused/banned or missing)"
      : "No active in-coverage dealer with quota in this city";
  }
  return "";
}

async function hydrateRows(docs: Record<string, unknown>[]): Promise<AdminLeadRow[]> {
  const cityIds = [...new Set(docs.map((d) => d.cityId).filter(Boolean).map(String))];
  const localityIds = [...new Set(docs.map((d) => d.localityId).filter(Boolean).map(String))];
  const listingIds = [...new Set(docs.map((d) => d.listingId).filter(Boolean).map(String))];
  const dealerIds = [
    ...new Set(docs.map((d) => d.assignedDealerId).filter(Boolean).map(String)),
  ];

  const [cities, localities, listings, dealers] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Locality.find({ _id: { $in: localityIds } }, { name: 1 }).lean(),
    Listing.find({ _id: { $in: listingIds } }, { title: 1 }).lean(),
    Dealer.find({ _id: { $in: dealerIds } }, { businessName: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const localityName = new Map(localities.map((l) => [String(l._id), l.name]));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const dealerById = new Map(dealers.map((d) => [String(d._id), d]));

  return docs.map((d) => {
    const listing = d.listingId ? listingById.get(String(d.listingId)) : undefined;
    const dealer = d.assignedDealerId ? dealerById.get(String(d.assignedDealerId)) : undefined;
    return {
      id: String(d._id),
      buyerName: (d.name as string) || (d.waProfileName as string) || "Unknown buyer",
      phone: String(d.phone),
      status: String(d.status),
      source: String(d.source),
      reason: reasonFor(String(d.status), String(d.source)),
      purpose: d.purpose as string | undefined,
      bhk: d.bhk as string | undefined,
      budget: budgetLabel(d.budgetMin as number, d.budgetMax as number),
      timeline: d.timeline as string | undefined,
      qualificationScore: d.qualificationScore as number | undefined,
      cityId: d.cityId ? String(d.cityId) : undefined,
      cityName: d.cityId ? cityName.get(String(d.cityId)) : undefined,
      localityName: d.localityId ? localityName.get(String(d.localityId)) : undefined,
      listing: listing ? { id: String(listing._id), title: listing.title ?? "(untitled)" } : undefined,
      assignedDealer: dealer
        ? { id: String(dealer._id), businessName: dealer.businessName }
        : undefined,
      createdAt: new Date((d.createdAt as Date) ?? new Date()).toISOString(),
    };
  });
}

// ---- unmatched / quota queue, grouped by city ----

export interface CityGroup {
  cityId: string;
  cityName: string;
  count: number;
  leads: AdminLeadRow[];
}
export interface UnmatchedQueue {
  totalUnmatched: number;
  groups: CityGroup[];
  /** Leads with no city resolved (can't be grouped). */
  ungrouped: AdminLeadRow[];
}

/** The admin queue: unmatched + quota-exceeded leads, GROUPED BY city. */
export async function getUnmatchedByCity(): Promise<UnmatchedQueue> {
  await connectDB();
  const docs = await Lead.find({
    status: { $in: ["unmatched", "quota-exceeded"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  const rows = await hydrateRows(docs);

  const byCity = new Map<string, CityGroup>();
  const ungrouped: AdminLeadRow[] = [];
  for (const r of rows) {
    if (!r.cityId) {
      ungrouped.push(r);
      continue;
    }
    let g = byCity.get(r.cityId);
    if (!g) {
      g = { cityId: r.cityId, cityName: r.cityName ?? "Unknown city", count: 0, leads: [] };
      byCity.set(r.cityId, g);
    }
    g.count += 1;
    g.leads.push(r);
  }

  const groups = [...byCity.values()].sort((a, b) => b.count - a.count);
  return { totalUnmatched: rows.length, groups, ungrouped };
}

// ---- full searchable list ----

const PAGE_SIZE = 25;

export interface AdminLeadsResult {
  rows: AdminLeadRow[];
  total: number;
  page: number;
  pageCount: number;
}

export async function getAllLeads(opts: {
  status?: string;
  cityId?: string;
  q?: string;
  page?: number;
}): Promise<AdminLeadsResult> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.cityId && mongoose.Types.ObjectId.isValid(opts.cityId)) {
    filter.cityId = new mongoose.Types.ObjectId(opts.cityId);
  }
  if (opts.q && opts.q.trim()) {
    const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { waProfileName: rx }];
  }

  const page = Math.max(1, opts.page ?? 1);
  const total = await Lead.countDocuments(filter);
  const docs = await Lead.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return {
    rows: await hydrateRows(docs),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Distinct cities present in the leads collection, for the filter dropdown. */
export async function getLeadCities(): Promise<{ id: string; name: string }[]> {
  await connectDB();
  const ids = (await Lead.distinct("cityId")).filter(Boolean);
  const cities = await City.find({ _id: { $in: ids } }, { name: 1 }).sort({ name: 1 }).lean();
  return cities.map((c) => ({ id: String(c._id), name: c.name }));
}

// ---- lead detail + conversation + audit ----

export interface ConversationMessage {
  direction: "in" | "out";
  body?: string;
  timestamp?: string;
}
export interface AuditEntry {
  action: string;
  actorType: string;
  actorId?: string;
  dealerName?: string;
  prevDealerName?: string;
  reason?: string;
  at: string;
}
export interface AdminLeadDetail extends AdminLeadRow {
  loanRequired?: boolean;
  dealerNotes?: string;
  conversation: ConversationMessage[];
  audit: AuditEntry[];
}

export async function getLeadDetail(id: string): Promise<AdminLeadDetail | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const doc = await Lead.findById(id).lean();
  if (!doc) return null;

  const [row] = await hydrateRows([doc as Record<string, unknown>]);

  const conv = await Conversation.findOne({ phone: doc.phone }).lean();
  const conversation: ConversationMessage[] = (conv?.messages ?? []).map((m) => ({
    direction: m.direction as "in" | "out",
    body: m.body ?? undefined,
    timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
  }));

  const auditDocs = await AuditLog.find({ leadId: doc._id }).sort({ createdAt: -1 }).lean();
  const dealerIds = [
    ...new Set(
      auditDocs
        .flatMap((a) => [a.dealerId, a.prevDealerId])
        .filter(Boolean)
        .map(String),
    ),
  ];
  const dealers = await Dealer.find({ _id: { $in: dealerIds } }, { businessName: 1 }).lean();
  const dealerName = new Map(dealers.map((d) => [String(d._id), d.businessName]));

  const audit: AuditEntry[] = auditDocs.map((a) => ({
    action: a.action,
    actorType: a.actorType,
    actorId: a.actorId ?? undefined,
    dealerName: a.dealerId ? dealerName.get(String(a.dealerId)) : undefined,
    prevDealerName: a.prevDealerId ? dealerName.get(String(a.prevDealerId)) : undefined,
    reason: a.reason ?? undefined,
    at: new Date((a.createdAt as Date) ?? new Date()).toISOString(),
  }));

  return {
    ...row!,
    loanRequired: doc.loanRequired ?? undefined,
    dealerNotes: doc.dealerNotes ?? undefined,
    conversation,
    audit,
  };
}

// ---- eligible dealers for admin assignment ----

export interface EligibleDealer {
  id: string;
  businessName: string;
  tier: number;
  rating: number;
  quota: string;
  hasQuota: boolean;
  coversCity: boolean;
  status: string;
}

/**
 * Active dealers the admin can assign a lead to. Dealers covering the lead's
 * city are listed first (and flagged); the rest of the active roster follows so
 * the admin can still place a lead anywhere (e.g. an override). Quota is shown,
 * not enforced - the admin decision is deliberate.
 */
export async function getEligibleDealers(cityId?: string): Promise<EligibleDealer[]> {
  await connectDB();
  const dealers = await Dealer.find(
    { status: "active" },
    {
      businessName: 1,
      verificationTier: 1,
      rating: 1,
      leadsUsedThisMonth: 1,
      maxLeadsPerMonth: 1,
      coverageCities: 1,
      status: 1,
    },
  ).lean();

  const rows = dealers.map((d) => {
    const coversCity = Boolean(
      cityId && (d.coverageCities ?? []).map(String).includes(cityId),
    );
    const used = d.leadsUsedThisMonth ?? 0;
    const max = d.maxLeadsPerMonth ?? 0;
    return {
      id: String(d._id),
      businessName: d.businessName,
      tier: d.verificationTier ?? 0,
      rating: d.rating ?? 0,
      quota: `${used}/${max}`,
      hasQuota: used < max,
      coversCity,
      status: d.status as string,
    };
  });

  // Coverage matches first, then higher tier, then rating.
  return rows.sort((a, b) => {
    if (a.coversCity !== b.coversCity) return a.coversCity ? -1 : 1;
    if (a.tier !== b.tier) return b.tier - a.tier;
    return b.rating - a.rating;
  });
}
