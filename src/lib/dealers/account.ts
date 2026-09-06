import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { getDealerSession } from "@/lib/auth/middleware";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { computeVerificationTier, type VerificationTier } from "@/lib/dealers/tier";

/**
 * The signed-in dealer's OWN account (DEV-SPEC.txt Sections 4, 13). Unlike the
 * public agent profile, this may include the dealer's private fields (documents,
 * coverage) because it is the dealer looking at their own data - the privacy
 * rules govern PUBLIC exposure, not a dealer's own dashboard.
 */

export interface DocStatus {
  key: "pan" | "aadhaar" | "gst" | "udyam" | "rera" | "officePhoto";
  label: string;
  uploaded: boolean;
  verified: boolean;
  mandatory: boolean;
  number?: string;
  stateId?: string;
}

export interface CoverageCity {
  cityId: string;
  cityName: string;
  stateId: string;
  localities: { localityId: string; name: string }[];
}

export interface DealerProfileFields {
  slug?: string;
  slugLockUntil?: string;
  tagline?: string;
  /** Raw (unsanitized) about — the dealer edits this; it's sanitized on save. */
  about?: string;
  establishedYear?: number;
  yearsExperience?: number;
  teamSize?: number;
  dealTypes: string[];
  languages: string[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  reraNumber?: string;
  gstNumber?: string;
  officeAddress?: string;
  mapLat?: number;
  mapLng?: number;
  workingHours: { day: string; open?: string; close?: string; closed: boolean }[];
  publicEmail?: string;
  publicEmailOptIn: boolean;
  publicPhoneOptIn: boolean;
  bannerImage?: { url: string; publicId?: string };
  logoImage?: { url: string; publicId?: string };
}

export interface MyDealer {
  id: string;
  name: string;
  businessName: string;
  email?: string;
  /** A requested-but-unverified new email awaiting confirmation, if any. */
  pendingEmail?: string;
  profilePhoto?: string;
  phone: string;
  phoneVerified: boolean;
  status: "active" | "paused" | "banned" | "pending";
  verificationTier: number;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  totalSiteVisits: number;
  plan: string;
  coverageCities: string[];
  coverageLocalities: string[];
  coverage: CoverageCity[];
  documents: DocStatus[];
  listingCounts: { total: number; approved: number; pending: number; draft: number };
  /** True once the dealer has filled in real profile + at least one coverage city. */
  profileComplete: boolean;
  /** Editable public-profile fields (Phase 4 edit panel). */
  profile: DealerProfileFields;
  /** Zenith Code automation connection (per-dealer OAuth). */
  zenithConnected: boolean;
  zenithNumber?: string;
  zenithPlan?: string;
  zenithConnectedAt?: string;
}

const DOC_META: { key: DocStatus["key"]; label: string; mandatory: boolean }[] = [
  { key: "pan", label: "PAN card", mandatory: true },
  { key: "aadhaar", label: "Aadhaar", mandatory: true },
  { key: "gst", label: "GST certificate", mandatory: false },
  { key: "udyam", label: "Udyam registration", mandatory: false },
  { key: "rera", label: "RERA registration", mandatory: false },
  { key: "officePhoto", label: "Office photo", mandatory: false },
];

/**
 * Map a Dealer document to the editable public-profile fields. Shared by the
 * dealer's own account view and the admin dealer view.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDealerProfileFields(d: any): DealerProfileFields {
  return {
    slug: d.slug ?? undefined,
    slugLockUntil: d.slugLockUntil ? new Date(d.slugLockUntil).toISOString() : undefined,
    tagline: d.tagline ?? undefined,
    about: d.about ?? undefined,
    establishedYear: d.establishedYear ?? undefined,
    yearsExperience: d.yearsExperience ?? undefined,
    teamSize: d.teamSize ?? undefined,
    dealTypes: d.dealTypes ?? [],
    languages: d.languages ?? [],
    priceRangeMin: d.priceRangeMin ?? undefined,
    priceRangeMax: d.priceRangeMax ?? undefined,
    reraNumber: d.reraNumber ?? undefined,
    gstNumber: d.gstNumber ?? undefined,
    officeAddress: d.officeAddress ?? undefined,
    mapLat: d.mapLat ?? undefined,
    mapLng: d.mapLng ?? undefined,
    workingHours: (d.workingHours ?? []).map(
      (w: { day?: string; open?: string; close?: string; closed?: boolean }) => ({
        day: w.day ?? "",
        open: w.open ?? undefined,
        close: w.close ?? undefined,
        closed: Boolean(w.closed),
      }),
    ),
    publicEmail: d.publicEmail ?? undefined,
    publicEmailOptIn: Boolean(d.publicEmailOptIn),
    publicPhoneOptIn: Boolean(d.publicPhoneOptIn),
    bannerImage: d.bannerImage?.url
      ? { url: d.bannerImage.url, publicId: d.bannerImage.publicId ?? undefined }
      : undefined,
    logoImage: d.logoImage?.url
      ? { url: d.logoImage.url, publicId: d.logoImage.publicId ?? undefined }
      : undefined,
  };
}

/** Resolve the signed-in dealer's full account, or null if not signed in. */
export async function getMyDealer(): Promise<MyDealer | null> {
  const session = await getDealerSession();
  if (!session) return null;

  await connectDB();
  const d = await Dealer.findById(session.dealerId).lean();
  if (!d) return null;

  const dealerId = new mongoose.Types.ObjectId(session.dealerId);

  // Listing counts by status.
  const [counts, coverage] = await Promise.all([
    Listing.aggregate<{ _id: string; n: number }>([
      { $match: { dealerId } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    resolveCoverage(d.coverageCities ?? [], d.coverageLocalities ?? []),
  ]);
  const byStatus = new Map(counts.map((c) => [c._id, c.n]));
  const total = counts.reduce((s, c) => s + c.n, 0);

  const docs = d.documents ?? {};
  const documents: DocStatus[] = DOC_META.map((m) => {
    const doc = (docs as Record<string, { url?: string; verified?: boolean; number?: string; stateId?: unknown }>)[m.key];
    return {
      key: m.key,
      label: m.label,
      uploaded: Boolean(doc?.url),
      verified: Boolean(doc?.verified),
      mandatory: m.mandatory,
      number: doc?.number,
      stateId: doc?.stateId ? String(doc.stateId) : undefined,
    };
  });

  const last4 = d.phone.slice(-4);
  const placeholder = `Dealer ${last4}`;
  const profileComplete =
    Boolean(d.businessName) &&
    d.businessName !== placeholder &&
    (d.coverageCities?.length ?? 0) > 0;

  return {
    id: String(d._id),
    name: d.name,
    businessName: d.businessName,
    email: d.email ?? undefined,
    pendingEmail: d.pendingEmail ?? undefined,
    phoneVerified: Boolean(d.phoneVerified),
    profilePhoto: d.profilePhoto ?? undefined,
    phone: d.phone,
    status: d.status as MyDealer["status"],
    verificationTier: d.verificationTier ?? 0,
    rating: d.rating ?? 0,
    ratingCount: d.ratingCount ?? 0,
    avgResponseMinutes: d.avgResponseMinutes ?? undefined,
    totalSiteVisits: d.totalSiteVisits ?? 0,
    plan: d.plan ?? "free",
    coverageCities: (d.coverageCities ?? []).map(String),
    coverageLocalities: (d.coverageLocalities ?? []).map(String),
    coverage,
    documents,
    listingCounts: {
      total,
      approved: byStatus.get("approved") ?? 0,
      pending: (byStatus.get("pending") ?? 0) + (byStatus.get("pending-location") ?? 0),
      draft: byStatus.get("draft") ?? 0,
    },
    profileComplete,
    profile: toDealerProfileFields(d),
    zenithConnected: Boolean(d.zenithConnected),
    zenithNumber: d.zenithNumber ?? undefined,
    zenithPlan: d.zenithPlan ?? undefined,
    zenithConnectedAt: d.zenithConnectedAt
      ? new Date(d.zenithConnectedAt).toISOString()
      : undefined,
  };
}

async function resolveCoverage(
  cityIds: unknown[],
  localityIds: unknown[],
): Promise<CoverageCity[]> {
  if (cityIds.length === 0) return [];
  const [cities, localities] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1, stateId: 1 }).lean(),
    Locality.find({ _id: { $in: localityIds } }, { name: 1, cityId: 1 }).lean(),
  ]);
  const locByCity = new Map<string, { localityId: string; name: string }[]>();
  for (const l of localities) {
    const key = String(l.cityId);
    if (!locByCity.has(key)) locByCity.set(key, []);
    locByCity.get(key)!.push({ localityId: String(l._id), name: l.name });
  }
  return cities
    .map((c) => ({
      cityId: String(c._id),
      cityName: c.name,
      stateId: String(c.stateId),
      localities: locByCity.get(String(c._id)) ?? [],
    }))
    .sort((a, b) => a.cityName.localeCompare(b.cityName));
}

// ---- verification tier ladder ----

export interface TierRung {
  tier: VerificationTier;
  label: string;
  requirements: { label: string; met: boolean }[];
  reached: boolean;
  isNext: boolean;
}

const TIER_LABEL: Record<number, string> = {
  0: "Unverified",
  1: "Verified",
  2: "Verified Business",
  3: "RERA Verified",
  4: "Premium Verified",
};

/** The tier ladder with per-requirement met/unmet, based on VERIFIED documents. */
export function tierLadder(dealer: MyDealer): TierRung[] {
  const v = (k: DocStatus["key"]) =>
    dealer.documents.find((d) => d.key === k)?.verified ?? false;

  const computed = computeVerificationTier({
    documents: {
      pan: { verified: v("pan") },
      aadhaar: { verified: v("aadhaar") },
      gst: { verified: v("gst") },
      udyam: { verified: v("udyam") },
      rera: { verified: v("rera") },
      officePhoto: { verified: v("officePhoto") },
    },
    totalSiteVisits: dealer.totalSiteVisits,
    rating: dealer.rating,
  });

  const rungs: Omit<TierRung, "reached" | "isNext">[] = [
    {
      tier: 1,
      label: TIER_LABEL[1]!,
      requirements: [
        { label: "PAN verified", met: v("pan") },
        { label: "Aadhaar verified", met: v("aadhaar") },
      ],
    },
    {
      tier: 2,
      label: TIER_LABEL[2]!,
      requirements: [{ label: "GST or Udyam verified", met: v("gst") || v("udyam") }],
    },
    {
      tier: 3,
      label: TIER_LABEL[3]!,
      requirements: [{ label: "RERA verified", met: v("rera") }],
    },
    {
      tier: 4,
      label: TIER_LABEL[4]!,
      requirements: [
        { label: "Office photo verified", met: v("officePhoto") },
        { label: "5+ completed site visits", met: dealer.totalSiteVisits >= 5 },
        { label: "Rating 4.0+", met: dealer.rating >= 4.0 },
      ],
    },
  ];

  return rungs.map((r) => ({
    ...r,
    reached: computed >= r.tier,
    isNext: r.tier === computed + 1,
  }));
}

export function tierName(tier: number): string {
  return TIER_LABEL[tier] ?? "Unverified";
}

export interface CompletenessItem {
  label: string;
  done: boolean;
  /** Required to qualify for search indexing (verified + 3 listings + about). */
  forIndex?: boolean;
}

export interface ProfileCompleteness {
  percent: number;
  qualifiesForIndex: boolean;
  items: CompletenessItem[];
}

/**
 * Profile-completeness meter (Phase 4). The `forIndex` items are the hard gate
 * for the profile to be indexable (verified + 3 live listings + about filled);
 * the rest raise the completeness percentage and richness of the public page.
 */
export function profileCompleteness(d: MyDealer): ProfileCompleteness {
  const p = d.profile;
  const items: CompletenessItem[] = [
    { label: "Verified (Tier 1 or higher)", done: d.verificationTier >= 1, forIndex: true },
    { label: "3+ live listings", done: d.listingCounts.approved >= 3, forIndex: true },
    { label: "About section written", done: Boolean(p.about && p.about.trim()), forIndex: true },
    { label: "Logo uploaded", done: Boolean(p.logoImage) },
    { label: "Banner uploaded", done: Boolean(p.bannerImage) },
    { label: "Tagline", done: Boolean(p.tagline && p.tagline.trim()) },
    { label: "Deal types selected", done: p.dealTypes.length > 0 },
    { label: "Service areas (coverage)", done: d.coverageCities.length > 0 },
    { label: "Working hours", done: p.workingHours.length > 0 },
    { label: "Office address", done: Boolean(p.officeAddress && p.officeAddress.trim()) },
  ];
  const done = items.filter((i) => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    qualifiesForIndex: items.filter((i) => i.forIndex).every((i) => i.done),
    items,
  };
}
