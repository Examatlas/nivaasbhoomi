import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * Location activation rules (DEV-SPEC.txt Section 13).
 *
 * These are the authoritative guards, enforced in the service layer - "API me
 * ye check enforce karo, UI pe bharosa mat karo". The checks run against LIVE
 * counts (real queries), never against the cached city.* counters, so an admin
 * cannot activate a city by hitting the API directly, and stale counters can
 * never let a premature activation through.
 *
 * Listing and Dealer are Phase-2 models and do not exist yet. Rather than define
 * partial schemas that would later compete with the real ones, we count through
 * the raw collections ("listings", "dealers") by their eventual Mongoose
 * collection names. On a locations-only database these collections are simply
 * empty, so every count is 0 and the guard fails cleanly with the reasons.
 */

const LISTINGS = "listings";
const DEALERS = "dealers";

// Thresholds straight from Section 13.
export const CITY_ACTIVATION_THRESHOLDS = {
  approvedListings: 25,
  verifiedDealers: 5, // dealers at verificationTier >= 1
  activeLocalities: 3,
} as const;

export const LOCALITY_ACTIVATION = {
  minIntroTextChars: 500,
  minApprovedListings: 3,
} as const;

function db() {
  const conn = mongoose.connection.db;
  if (!conn) throw new Error("Database connection not ready");
  return conn;
}

async function countApprovedListingsInCity(
  cityId: mongoose.Types.ObjectId,
): Promise<number> {
  // Seed (display-only) listings NEVER count toward activation.
  return db().collection(LISTINGS).countDocuments({ cityId, status: "approved", isSeed: { $ne: true } });
}

async function countApprovedListingsInLocality(
  localityId: mongoose.Types.ObjectId,
): Promise<number> {
  return db().collection(LISTINGS).countDocuments({ localityId, status: "approved", isSeed: { $ne: true } });
}

async function countVerifiedDealersInCity(
  cityId: mongoose.Types.ObjectId,
): Promise<number> {
  return db()
    .collection(DEALERS)
    .countDocuments({
      coverageCities: cityId,
      verificationTier: { $gte: 1 },
      status: { $ne: "banned" },
    });
}

// ---- City activation guard --------------------------------------------------

export interface CityActivationCheck {
  ok: boolean;
  counts: {
    approvedListings: number;
    verifiedDealers: number;
    activeLocalities: number;
  };
  thresholds: typeof CITY_ACTIVATION_THRESHOLDS;
  /** Human-readable reasons the city cannot yet be activated (empty when ok). */
  missing: string[];
}

/**
 * Can this city be set isActive = true? (Section 13 guard.)
 * Returns pass/fail plus current counts and exactly what is missing, so the
 * admin UI can show what is still needed without duplicating the rule.
 */
export async function canActivateCity(
  cityId: string | mongoose.Types.ObjectId,
): Promise<CityActivationCheck> {
  await connectDB();
  const _id = new mongoose.Types.ObjectId(String(cityId));

  const [approvedListings, verifiedDealers, activeLocalities] = await Promise.all([
    countApprovedListingsInCity(_id),
    countVerifiedDealersInCity(_id),
    Locality.countDocuments({ cityId: _id, isActive: true }),
  ]);

  const t = CITY_ACTIVATION_THRESHOLDS;
  const missing: string[] = [];
  if (approvedListings < t.approvedListings) {
    missing.push(
      `Needs ${t.approvedListings} approved listings (has ${approvedListings}).`,
    );
  }
  if (verifiedDealers < t.verifiedDealers) {
    missing.push(
      `Needs ${t.verifiedDealers} verified dealers at tier 1+ (has ${verifiedDealers}).`,
    );
  }
  if (activeLocalities < t.activeLocalities) {
    missing.push(
      `Needs ${t.activeLocalities} active localities (has ${activeLocalities}).`,
    );
  }

  return {
    ok: missing.length === 0,
    counts: { approvedListings, verifiedDealers, activeLocalities },
    thresholds: t,
    missing,
  };
}

/**
 * Activate a city, enforcing the guard. Throws CityActivationError if the guard
 * fails - callers surface that as a 422. This is the ONLY sanctioned way to set
 * a city active, so the guard can never be bypassed.
 */
export class CityActivationError extends Error {
  constructor(public readonly check: CityActivationCheck) {
    super("City does not meet the activation requirements.");
    this.name = "CityActivationError";
  }
}

export async function activateCity(
  cityId: string | mongoose.Types.ObjectId,
): Promise<CityActivationCheck> {
  const check = await canActivateCity(cityId);
  if (!check.ok) throw new CityActivationError(check);

  await City.updateOne(
    { _id: new mongoose.Types.ObjectId(String(cityId)) },
    { $set: { isActive: true } },
  );
  return check;
}

/** Deactivating a city is always allowed (it is a manual admin decision). */
export async function deactivateCity(
  cityId: string | mongoose.Types.ObjectId,
): Promise<void> {
  await connectDB();
  await City.updateOne(
    { _id: new mongoose.Types.ObjectId(String(cityId)) },
    { $set: { isActive: false } },
  );
}

// ---- Locality automatic activation ------------------------------------------

export interface LocalityActivationResult {
  isActive: boolean;
  reasons: string[];
  counts: { approvedListings: number; introTextChars: number };
}

/**
 * Recompute a locality's isActive automatically (Section 13):
 *   status === 'approved' AND introText.length >= 500 AND approvedListings >= 3.
 * Persists the new isActive and returns why. Call on every listing
 * approve/expire and whenever a locality's content or status changes.
 */
export async function recalculateLocalityActivation(
  localityId: string | mongoose.Types.ObjectId,
): Promise<LocalityActivationResult> {
  await connectDB();
  const _id = new mongoose.Types.ObjectId(String(localityId));

  const locality = await Locality.findById(_id, {
    status: 1,
    introText: 1,
    isActive: 1,
  }).lean();
  if (!locality) throw new Error("Locality not found");

  const introTextChars = (locality.introText ?? "").trim().length;
  const approvedListings = await countApprovedListingsInLocality(_id);

  const reasons: string[] = [];
  if (locality.status !== "approved") reasons.push("Status is not 'approved'.");
  if (introTextChars < LOCALITY_ACTIVATION.minIntroTextChars) {
    reasons.push(
      `introText is ${introTextChars} chars (needs ${LOCALITY_ACTIVATION.minIntroTextChars}).`,
    );
  }
  if (approvedListings < LOCALITY_ACTIVATION.minApprovedListings) {
    reasons.push(
      `Has ${approvedListings} approved listings (needs ${LOCALITY_ACTIVATION.minApprovedListings}).`,
    );
  }

  const isActive = reasons.length === 0;
  // Persist both the activation flag and the approved-listing counter so the
  // locality's own listingCount stays accurate (used by the admin UI and the
  // expiry cron's < 3 check).
  await Locality.updateOne(
    { _id },
    { $set: { isActive, listingCount: approvedListings } },
  );

  return { isActive, reasons, counts: { approvedListings, introTextChars } };
}

// ---- Counter maintenance ----------------------------------------------------

export interface CityCounters {
  listingCount: number;
  dealerCount: number;
  localityCount: number;
}

/**
 * Recompute and persist a city's display counters (Section 4). These drive the
 * admin readiness table and public SEO copy; they are NOT the source of truth
 * for the activation guard (that uses live queries above).
 *
 *   listingCount  = approved listings in the city
 *   dealerCount   = non-banned dealers covering the city
 *   localityCount = total localities in the city
 */
export async function recalculateCounters(
  cityId: string | mongoose.Types.ObjectId,
): Promise<CityCounters> {
  await connectDB();
  const _id = new mongoose.Types.ObjectId(String(cityId));

  const [listingCount, dealerCount, localityCount] = await Promise.all([
    countApprovedListingsInCity(_id),
    db()
      .collection(DEALERS)
      .countDocuments({ coverageCities: _id, status: { $ne: "banned" } }),
    Locality.countDocuments({ cityId: _id }),
  ]);

  await City.updateOne({ _id }, { $set: { listingCount, dealerCount, localityCount } });

  return { listingCount, dealerCount, localityCount };
}
