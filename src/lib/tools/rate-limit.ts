/**
 * Pure rate-limit rule for lead-magnet tool submissions: 5 per hour per IP.
 * (No DB here so it is unit-tested; the endpoint counts ToolSubmitLog rows.)
 */
export const TOOL_RATE_PER_IP = 5;
export const TOOL_RATE_WINDOW_SECONDS = 3600;

export interface ToolRateDecision {
  allowed: boolean;
  retryAfter: number; // seconds (only when blocked)
}

export function toolRateLimitDecision(ipCount: number): ToolRateDecision {
  if (ipCount >= TOOL_RATE_PER_IP) {
    return { allowed: false, retryAfter: TOOL_RATE_WINDOW_SECONDS };
  }
  return { allowed: true, retryAfter: 0 };
}
