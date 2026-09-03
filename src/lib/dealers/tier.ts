/**
 * Dealer verification tier computation (DEV-SPEC.txt Section 13).
 *
 * Pure and side-effect-free so it can be unit-tested directly and reused by the
 * Dealer pre-validate hook. The tiers are strictly cumulative:
 *
 *   Tier 0: default
 *   Tier 1: pan.verified AND aadhaar.verified
 *   Tier 2: Tier 1 AND (gst.verified OR udyam.verified)
 *   Tier 3: Tier 2 AND rera.verified
 *   Tier 4: Tier 3 AND officePhoto.verified AND totalSiteVisits >= 5
 *           AND rating >= 4.0
 *
 * "Tier compute automatic ho, par admin manually downgrade kar sake": the
 * computed tier is the ceiling, and an admin override can only lower it - see
 * effectiveVerificationTier.
 */

export type VerificationTier = 0 | 1 | 2 | 3 | 4;

interface VerifiableDoc {
  verified?: boolean | null;
}

export interface TierInput {
  documents?: {
    pan?: VerifiableDoc | null;
    aadhaar?: VerifiableDoc | null;
    gst?: VerifiableDoc | null;
    udyam?: VerifiableDoc | null;
    rera?: VerifiableDoc | null;
    officePhoto?: VerifiableDoc | null;
  } | null;
  totalSiteVisits?: number | null;
  rating?: number | null;
}

const TIER4_MIN_SITE_VISITS = 5;
const TIER4_MIN_RATING = 4.0;

/** Compute the tier a dealer has earned from their verified documents. */
export function computeVerificationTier(input: TierInput): VerificationTier {
  const d = input.documents ?? {};

  const panOk = Boolean(d.pan?.verified);
  const aadhaarOk = Boolean(d.aadhaar?.verified);
  if (!panOk || !aadhaarOk) return 0;

  const gstOrUdyam = Boolean(d.gst?.verified) || Boolean(d.udyam?.verified);
  if (!gstOrUdyam) return 1;

  if (!d.rera?.verified) return 2;

  const officeOk = Boolean(d.officePhoto?.verified);
  const visitsOk = (input.totalSiteVisits ?? 0) >= TIER4_MIN_SITE_VISITS;
  const ratingOk = (input.rating ?? 0) >= TIER4_MIN_RATING;
  if (!officeOk || !visitsOk || !ratingOk) return 3;

  return 4;
}

/**
 * Apply an admin's manual downgrade. The override can only pull the tier DOWN,
 * never above what the documents actually earn, so a mistaken high override can
 * never grant unearned trust.
 */
export function effectiveVerificationTier(
  computed: VerificationTier,
  override?: number | null,
): VerificationTier {
  if (override == null) return computed;
  return Math.min(computed, override) as VerificationTier;
}
