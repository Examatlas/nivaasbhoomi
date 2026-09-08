import { Dealer } from "@/lib/db/models/Dealer";
import { hasRemainingQuota } from "@/lib/leads/quota-guard";

/**
 * Safe, public-card dealer fields. This is the SINGLE source of truth for what a
 * listing card may know about a dealer. It must NEVER grow to include
 * zenithAccessTokenEnc / zenithRefreshTokenEnc / zenithOrgId or any token field.
 */
export interface DealerCardInfo {
  verificationTier: number;
  zenithConnected: boolean;
  zenithNumber: string | null;
  /** True when the dealer is over their monthly lead quota — their listings
   *  rank BELOW available dealers' (never hidden). STEP 3.4. */
  quotaExhausted: boolean;
}

/** Batch-fetch the safe card fields for a set of dealer ids, keyed by id. */
export async function fetchDealerCardInfo(
  dealerIds: string[],
): Promise<Map<string, DealerCardInfo>> {
  if (dealerIds.length === 0) return new Map();
  const dealers = await Dealer.find(
    { _id: { $in: dealerIds } },
    { verificationTier: 1, zenithConnected: 1, zenithNumber: 1, leadsUsedThisMonth: 1, maxLeadsPerMonth: 1 },
  ).lean();
  return new Map(
    dealers.map((d) => [
      String(d._id),
      {
        verificationTier: d.verificationTier ?? 0,
        zenithConnected: Boolean(d.zenithConnected),
        // Expose the number only when actually connected.
        zenithNumber: d.zenithConnected ? (d.zenithNumber ?? null) : null,
        quotaExhausted: !hasRemainingQuota(d.leadsUsedThisMonth ?? 0, d.maxLeadsPerMonth ?? 0),
      } satisfies DealerCardInfo,
    ]),
  );
}

/**
 * Stable ranking for listing rows (STEP 3.4): keep the incoming order but push
 * listings whose dealer is over quota to the BOTTOM (never hidden). Array.sort
 * is stable, so the existing sort (freshness / price) is preserved within each
 * group. Mutates and returns the array.
 */
export function rankRowsByDealerQuota<T extends { dealerId: unknown }>(
  rows: T[],
  info: Map<string, DealerCardInfo>,
): T[] {
  return rows.sort(
    (a, b) =>
      Number(info.get(String(a.dealerId))?.quotaExhausted ?? false) -
      Number(info.get(String(b.dealerId))?.quotaExhausted ?? false),
  );
}
