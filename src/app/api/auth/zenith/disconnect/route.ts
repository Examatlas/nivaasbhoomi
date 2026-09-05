import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { getDealerSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * POST /api/auth/zenith/disconnect   [dealer auth]
 *
 * Clears the dealer's Zenith connection (tokens, number, plan) and flips their
 * listings' button back to "Contact Us". The dealer's own session gates it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async () => {
  const session = await getDealerSession();
  if (!session) return fail("UNAUTHORIZED", "Please sign in as a dealer.");

  await connectDB();
  const dealer = await Dealer.findById(session.dealerId);
  if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

  dealer.zenithConnected = false;
  dealer.zenithAccessTokenEnc = null;
  dealer.zenithRefreshTokenEnc = null;
  dealer.zenithTokenExpiresAt = null;
  dealer.zenithNumber = null;
  dealer.zenithPlan = null;
  dealer.zenithConnectedAt = null;
  await dealer.save();

  return ok({ disconnected: true });
});
