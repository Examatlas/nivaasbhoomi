import type { NextRequest } from "next/server";
import mongoose from "mongoose";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { generateAgentKey } from "@/lib/agent/key";

/**
 * POST /api/admin/dealers/[id]/agent-key   [admin]
 *
 * Generate (or regenerate) the dealer's Agent API key. Regenerating overwrites
 * the stored hash, so the old key stops working IMMEDIATELY. The plaintext is
 * returned in THIS response only and is never stored or logged — only its
 * SHA-256 hash + last 4 chars persist.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]/agent-key">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid dealer id.");

    await connectDB();
    const { plaintext, hash, last4 } = generateAgentKey();
    const now = new Date();
    const res = await Dealer.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          agentApiKeyHash: hash,
          agentApiKeyLast4: last4,
          agentApiKeyCreatedAt: now,
          agentApiKeyLastUsedAt: null,
        },
      },
    );
    if (res.matchedCount === 0) return fail("NOT_FOUND", "Dealer not found.");

    // The plaintext is shown ONCE. Never returned again.
    return ok({ key: plaintext, last4, createdAt: now.toISOString() });
  },
);
