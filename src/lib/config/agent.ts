/**
 * Agent API config. AGENT_LEADS_COUNT_TOWARD_QUOTA decides whether a lead that
 * arrives from a dealer's OWN Zenith agent counts against their monthly lead
 * quota. Default FALSE: it's the dealer's own traffic (their agent, their
 * contacts), not a lead we routed to them, so it shouldn't consume quota.
 */
export function agentLeadsCountTowardQuota(): boolean {
  return process.env.AGENT_LEADS_COUNT_TOWARD_QUOTA === "true";
}
