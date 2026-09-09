import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { AgentApiLog } from "@/lib/db/models/AgentApiLog";
import { hashAgentKey } from "@/lib/agent/key";
import { agentRateLimitDecision } from "@/lib/agent/rate-limit";
import { fail } from "@/lib/api/response";

/**
 * Resolve the dealer behind an Agent API request from the X-Agent-Key header.
 *
 * SECURITY: the returned dealerId is the ONLY source of scope — every query in
 * the route filters on it server-side, never on client input. Missing/invalid
 * key → 401; dealer not active → 403; over the per-key rate limit → 429 with a
 * Retry-After header. The key is hashed for lookup and never logged.
 */
export interface AgentContext {
  dealerId: string;
}

export type AgentGuard = { ctx: AgentContext } | { error: NextResponse };

export async function requireAgentDealer(req: NextRequest): Promise<AgentGuard> {
  const key = req.headers.get("x-agent-key")?.trim();
  if (!key) return { error: fail("UNAUTHORIZED", "Missing X-Agent-Key header.") };

  await connectDB();
  const dealer = await Dealer.findOne(
    { agentApiKeyHash: hashAgentKey(key) },
    { status: 1 },
  ).lean();
  if (!dealer) return { error: fail("UNAUTHORIZED", "Invalid API key.") };
  if (dealer.status !== "active") {
    return { error: fail("FORBIDDEN", "Dealer account is not active.") };
  }

  // Per-key rate limit: 60/min, 2000/day (counted from this dealer's log rows).
  const now = Date.now();
  const [minuteCount, dayCount] = await Promise.all([
    AgentApiLog.countDocuments({ dealerId: dealer._id, createdAt: { $gte: new Date(now - 60_000) } }),
    AgentApiLog.countDocuments({
      dealerId: dealer._id,
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
    }),
  ]);
  const rate = agentRateLimitDecision(minuteCount, dayCount);
  if (!rate.allowed) {
    const res = fail("RATE_LIMITED", "Rate limit exceeded. Try again later.", {
      retryAfter: rate.retryAfter,
    });
    res.headers.set("Retry-After", String(rate.retryAfter));
    return { error: res };
  }

  // Best-effort "last used" (never block the request on it).
  void Dealer.updateOne(
    { _id: dealer._id },
    { $set: { agentApiKeyLastUsedAt: new Date() } },
  ).catch(() => {});

  return { ctx: { dealerId: String(dealer._id) } };
}

/** Log a completed Agent request (rate-limit source + admin display). Never
 *  stores the key or any PII; best-effort. */
export async function logAgentRequest(
  dealerId: string,
  endpoint: "search" | "lead",
  status: number,
  ms: number,
): Promise<void> {
  try {
    await AgentApiLog.create({ dealerId, endpoint, status, ms });
  } catch {
    /* best-effort */
  }
}
