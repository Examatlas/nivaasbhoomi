/**
 * Pure per-key rate-limit rule for the Agent API: 60 requests/minute and
 * 2000/day. No DB here (unit-tested); the endpoint counts AgentApiLog rows in
 * each window and passes them in.
 */
export const AGENT_RATE_PER_MINUTE = 60;
export const AGENT_RATE_PER_DAY = 2000;

export interface AgentRateDecision {
  allowed: boolean;
  /** Seconds to wait (Retry-After) — only meaningful when blocked. */
  retryAfter: number;
}

export function agentRateLimitDecision(minuteCount: number, dayCount: number): AgentRateDecision {
  if (minuteCount >= AGENT_RATE_PER_MINUTE) return { allowed: false, retryAfter: 60 };
  if (dayCount >= AGENT_RATE_PER_DAY) return { allowed: false, retryAfter: 3600 };
  return { allowed: true, retryAfter: 0 };
}
