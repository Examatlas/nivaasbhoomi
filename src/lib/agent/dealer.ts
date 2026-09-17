import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";

/**
 * The Agent API key's own dealer record ("who am I"). Unlike getAgentProfile()
 * (the PUBLIC profile a third party sees), this is the dealer reading their own
 * account, so phone/email are always included regardless of the public opt-in
 * flags — this is self-access, not public exposure.
 *
 * Still an explicit projection: passwordHash, verification documents, Zenith
 * tokens, and the agent key hash are NEVER pulled from the DB.
 */
export interface AgentDealerDetails {
  id: string;
  name: string;
  businessName: string;
  slug?: string;
  email?: string;
  phone: string;
  profilePhoto?: string;
  logoImage?: string;
  bannerImage?: string;
  tagline?: string;
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
  verificationTier: number;
  status: string;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  totalLeadsReceived: number;
  totalSiteVisits: number;
  plan: string;
  maxLeadsPerMonth: number;
  leadsUsedThisMonth: number;
  coverageCities: { name: string; slug: string }[];
  zenithConnected: boolean;
  zenithNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getMyAgentDealer(dealerId: string): Promise<AgentDealerDetails | null> {
  await connectDB();

  const dealer = await Dealer.findOne(
    { _id: dealerId },
    {
      name: 1,
      businessName: 1,
      slug: 1,
      email: 1,
      phone: 1,
      profilePhoto: 1,
      logoImage: 1,
      bannerImage: 1,
      tagline: 1,
      about: 1,
      establishedYear: 1,
      yearsExperience: 1,
      teamSize: 1,
      dealTypes: 1,
      languages: 1,
      priceRangeMin: 1,
      priceRangeMax: 1,
      reraNumber: 1,
      gstNumber: 1,
      officeAddress: 1,
      mapLat: 1,
      mapLng: 1,
      workingHours: 1,
      verificationTier: 1,
      status: 1,
      rating: 1,
      ratingCount: 1,
      avgResponseMinutes: 1,
      totalLeadsReceived: 1,
      totalSiteVisits: 1,
      plan: 1,
      maxLeadsPerMonth: 1,
      leadsUsedThisMonth: 1,
      coverageCities: 1,
      zenithConnected: 1,
      zenithNumber: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ).lean();
  if (!dealer) return null;

  const coverageIds = (dealer.coverageCities ?? []).map((c) =>
    typeof c === "object" ? c : new mongoose.Types.ObjectId(String(c)),
  );
  const coverageCities =
    coverageIds.length > 0
      ? (
          await City.find({ _id: { $in: coverageIds } }, { name: 1, slug: 1 })
            .sort({ name: 1 })
            .lean()
        ).map((c) => ({ name: c.name, slug: c.slug }))
      : [];

  return {
    id: String(dealer._id),
    name: dealer.name,
    businessName: dealer.businessName,
    slug: dealer.slug ?? undefined,
    email: dealer.email ?? undefined,
    phone: dealer.phone,
    profilePhoto: dealer.profilePhoto ?? undefined,
    logoImage: dealer.logoImage?.url ?? undefined,
    bannerImage: dealer.bannerImage?.url ?? undefined,
    tagline: dealer.tagline ?? undefined,
    about: dealer.about ?? undefined,
    establishedYear: dealer.establishedYear ?? undefined,
    yearsExperience: dealer.yearsExperience ?? undefined,
    teamSize: dealer.teamSize ?? undefined,
    dealTypes: dealer.dealTypes ?? [],
    languages: dealer.languages ?? [],
    priceRangeMin: dealer.priceRangeMin ?? undefined,
    priceRangeMax: dealer.priceRangeMax ?? undefined,
    reraNumber: dealer.reraNumber ?? undefined,
    gstNumber: dealer.gstNumber ?? undefined,
    officeAddress: dealer.officeAddress ?? undefined,
    mapLat: dealer.mapLat ?? undefined,
    mapLng: dealer.mapLng ?? undefined,
    workingHours: (dealer.workingHours ?? []).map((w) => ({
      day: w.day ?? "",
      open: w.open ?? undefined,
      close: w.close ?? undefined,
      closed: Boolean(w.closed),
    })),
    verificationTier: dealer.verificationTier ?? 0,
    status: dealer.status,
    rating: dealer.rating ?? 0,
    ratingCount: dealer.ratingCount ?? 0,
    avgResponseMinutes: dealer.avgResponseMinutes ?? undefined,
    totalLeadsReceived: dealer.totalLeadsReceived ?? 0,
    totalSiteVisits: dealer.totalSiteVisits ?? 0,
    plan: dealer.plan ?? "free",
    maxLeadsPerMonth: dealer.maxLeadsPerMonth ?? 0,
    leadsUsedThisMonth: dealer.leadsUsedThisMonth ?? 0,
    coverageCities,
    zenithConnected: Boolean(dealer.zenithConnected),
    zenithNumber: dealer.zenithConnected ? (dealer.zenithNumber ?? null) : null,
    createdAt: (dealer.createdAt ?? new Date()).toISOString(),
    updatedAt: (dealer.updatedAt ?? new Date()).toISOString(),
  };
}
