import { ok, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { generateAgentKey } from "@/lib/agent/key";

/**
 * POST /api/dealers/me/agent-key   [dealer auth]
 *
 * Creates a credential for the signed-in dealer's external integration. The
 * plaintext key is returned exactly once; only its hash and display suffix are
 * retained. Regenerating invalidates the previous key immediately.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async () => {
  const auth = await requireDealer();
  if ("error" in auth) return auth.error;

  await connectDB();
  const { plaintext, hash, last4 } = generateAgentKey();
  const createdAt = new Date();
  await Dealer.updateOne(
    { _id: auth.identity.dealerId },
    {
      $set: {
        agentApiKeyHash: hash,
        agentApiKeyLast4: last4,
        agentApiKeyCreatedAt: createdAt,
        agentApiKeyLastUsedAt: null,
      },
    },
  );

  return ok({ key: plaintext, last4, createdAt: createdAt.toISOString() });
});
