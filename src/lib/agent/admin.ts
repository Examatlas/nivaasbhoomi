import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { AgentApiLog } from "@/lib/db/models/AgentApiLog";

export interface AgentKeyInfo {
  hasKey: boolean;
  last4: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
  zenithOrgId: string | null;
  requestsToday: number;
}

/** Agent-key display info for the admin dealer page (never returns the key). */
export async function getAgentKeyInfo(dealerId: string): Promise<AgentKeyInfo | null> {
  if (!mongoose.Types.ObjectId.isValid(dealerId)) return null;
  await connectDB();
  const _id = new mongoose.Types.ObjectId(dealerId);
  const d = await Dealer.findById(_id, {
    agentApiKeyHash: 1,
    agentApiKeyLast4: 1,
    agentApiKeyCreatedAt: 1,
    agentApiKeyLastUsedAt: 1,
    zenithOrgId: 1,
  }).lean();
  if (!d) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const requestsToday = await AgentApiLog.countDocuments({
    dealerId: _id,
    createdAt: { $gte: startOfDay },
  });

  return {
    hasKey: Boolean(d.agentApiKeyHash),
    last4: d.agentApiKeyLast4 ?? null,
    createdAt: d.agentApiKeyCreatedAt ? new Date(d.agentApiKeyCreatedAt).toISOString() : null,
    lastUsedAt: d.agentApiKeyLastUsedAt ? new Date(d.agentApiKeyLastUsedAt).toISOString() : null,
    zenithOrgId: d.zenithOrgId ?? null,
    requestsToday,
  };
}
