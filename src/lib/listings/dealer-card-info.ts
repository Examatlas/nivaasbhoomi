import { Dealer } from "@/lib/db/models/Dealer";

/**
 * Safe, public-card dealer fields. This is the SINGLE source of truth for what a
 * listing card may know about a dealer. It must NEVER grow to include
 * zenithAccessTokenEnc / zenithRefreshTokenEnc / zenithOrgId or any token field.
 */
export interface DealerCardInfo {
  verificationTier: number;
  zenithConnected: boolean;
  zenithNumber: string | null;
}

/** Batch-fetch the safe card fields for a set of dealer ids, keyed by id. */
export async function fetchDealerCardInfo(
  dealerIds: string[],
): Promise<Map<string, DealerCardInfo>> {
  if (dealerIds.length === 0) return new Map();
  const dealers = await Dealer.find(
    { _id: { $in: dealerIds } },
    { verificationTier: 1, zenithConnected: 1, zenithNumber: 1 },
  ).lean();
  return new Map(
    dealers.map((d) => [
      String(d._id),
      {
        verificationTier: d.verificationTier ?? 0,
        zenithConnected: Boolean(d.zenithConnected),
        // Expose the number only when actually connected.
        zenithNumber: d.zenithConnected ? (d.zenithNumber ?? null) : null,
      } satisfies DealerCardInfo,
    ]),
  );
}
