import { randomBytes, createHash } from "node:crypto";

/**
 * Dealer Agent API key (P3). Format: "nb_agent_" + 32 random bytes (base64url).
 * The PLAINTEXT is shown exactly once (at generate time) and never stored; the
 * DB keeps only a SHA-256 hash + the last 4 chars for display.
 */
export const AGENT_KEY_PREFIX = "nb_agent_";

export interface GeneratedAgentKey {
  plaintext: string;
  hash: string;
  last4: string;
}

/** SHA-256 hex of a key (the value stored + looked up). Trims first. */
export function hashAgentKey(plaintext: string): string {
  return createHash("sha256").update((plaintext ?? "").trim()).digest("hex");
}

export function generateAgentKey(): GeneratedAgentKey {
  const plaintext = AGENT_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { plaintext, hash: hashAgentKey(plaintext), last4: plaintext.slice(-4) };
}
