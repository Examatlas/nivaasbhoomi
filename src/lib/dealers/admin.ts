import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { Listing } from "@/lib/db/models/Listing";
import { State } from "@/lib/db/models/State";
import { tierName, toDealerProfileFields } from "@/lib/dealers/account";
import type { DealerProfileFields } from "@/lib/dealers/account";

/**
 * Admin dealer + verification views (DEV-SPEC.txt Sections 13, 15). These
 * surface the private document fields intentionally - it is the admin verifying
 * a dealer, not a public read.
 */

export interface AdminDealerRow {
  id: string;
  businessName: string;
  phone: string;
  tier: number;
  tierLabel: string;
  status: string;
  rating: number;
  ratingCount: number;
  uploadedDocs: number;
  verifiedDocs: number;
}

const DOC_KEYS = ["pan", "aadhaar", "gst", "udyam", "rera", "officePhoto"] as const;

export async function getDealersForAdmin(opts: {
  q?: string;
  status?: string;
}): Promise<AdminDealerRow[]> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.q?.trim()) {
    const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ businessName: rx }, { name: rx }, { phone: rx }];
  }

  const dealers = await Dealer.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return dealers.map((d) => {
    const docs = (d.documents ?? {}) as Record<string, { url?: string; verified?: boolean }>;
    let uploaded = 0;
    let verified = 0;
    for (const k of DOC_KEYS) {
      if (docs[k]?.url) uploaded += 1;
      if (docs[k]?.verified) verified += 1;
    }
    return {
      id: String(d._id),
      businessName: d.businessName,
      phone: d.phone,
      tier: d.verificationTier ?? 0,
      tierLabel: tierName(d.verificationTier ?? 0),
      status: d.status as string,
      rating: d.rating ?? 0,
      ratingCount: d.ratingCount ?? 0,
      uploadedDocs: uploaded,
      verifiedDocs: verified,
    };
  });
}

export interface AdminDocView {
  key: (typeof DOC_KEYS)[number];
  label: string;
  url?: string;
  verified: boolean;
  number?: string;
  /** RERA only: the state's official portal (State.reraPortalUrl) + state name. */
  reraStateName?: string;
  reraPortalUrl?: string;
}

export interface AdminDealerVerification {
  id: string;
  businessName: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  tier: number;
  tierLabel: string;
  tierOverride: number | null;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  verificationNotes?: string;
  liveListings: number;
  documents: AdminDocView[];
  zenithConnected: boolean;
  zenithNumber?: string;
  zenithOrgId?: string;
  /** Public-profile fields (admin can force-edit any of these). */
  profile: DealerProfileFields;
  /** Every slug this dealer has ever held; the first is the current one. */
  slugHistory: string[];
  /** Private uploaded verification documents (admin-only). */
  verificationDocs: {
    type?: string;
    url?: string;
    publicId?: string;
    verified: boolean;
    uploadedAt?: string;
  }[];
}

const DOC_META: { key: (typeof DOC_KEYS)[number]; label: string }[] = [
  { key: "pan", label: "PAN card" },
  { key: "aadhaar", label: "Aadhaar" },
  { key: "gst", label: "GST certificate" },
  { key: "udyam", label: "Udyam registration" },
  { key: "rera", label: "RERA registration" },
  { key: "officePhoto", label: "Office photo" },
];

export async function getDealerVerification(
  id: string,
): Promise<AdminDealerVerification | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const d = await Dealer.findById(id).lean();
  if (!d) return null;

  const docs = (d.documents ?? {}) as Record<
    string,
    { url?: string; verified?: boolean; number?: string; stateId?: unknown }
  >;

  // RERA is state-wise: resolve the state's official portal for the admin.
  let reraStateName: string | undefined;
  let reraPortalUrl: string | undefined;
  const reraStateId = docs.rera?.stateId;
  if (reraStateId) {
    const state = await State.findById(reraStateId, { name: 1, reraPortalUrl: 1 }).lean();
    reraStateName = state?.name;
    reraPortalUrl = state?.reraPortalUrl ?? undefined;
  }

  const documents: AdminDocView[] = DOC_META.map((m) => {
    const doc = docs[m.key];
    return {
      key: m.key,
      label: m.label,
      url: doc?.url,
      verified: Boolean(doc?.verified),
      number: doc?.number,
      ...(m.key === "rera" ? { reraStateName, reraPortalUrl } : {}),
    };
  });

  const liveListings = await Listing.countDocuments({ dealerId: d._id, status: "approved" });

  return {
    id: String(d._id),
    businessName: d.businessName,
    name: d.name,
    phone: d.phone,
    email: d.email ?? undefined,
    status: d.status as string,
    tier: d.verificationTier ?? 0,
    tierLabel: tierName(d.verificationTier ?? 0),
    tierOverride: (d.verificationTierOverride ?? null) as number | null,
    rating: d.rating ?? 0,
    ratingCount: d.ratingCount ?? 0,
    avgResponseMinutes: d.avgResponseMinutes ?? undefined,
    verificationNotes: d.verificationNotes ?? undefined,
    liveListings,
    documents,
    zenithConnected: Boolean(d.zenithConnected),
    zenithNumber: d.zenithNumber ?? undefined,
    zenithOrgId: d.zenithOrgId ?? undefined,
    profile: toDealerProfileFields(d),
    slugHistory: [
      ...(d.slug ? [d.slug] : []),
      ...((d.slugHistory ?? []) as string[]).filter((s) => s && s !== d.slug),
    ],
    verificationDocs: ((d.verificationDocs ?? []) as Array<{
      type?: string;
      url?: string;
      publicId?: string;
      verified?: boolean;
      uploadedAt?: Date | string;
    }>).map((v) => ({
      type: v.type ?? undefined,
      url: v.url ?? undefined,
      publicId: v.publicId ?? undefined,
      verified: Boolean(v.verified),
      uploadedAt: v.uploadedAt ? new Date(v.uploadedAt).toISOString() : undefined,
    })),
  };
}
