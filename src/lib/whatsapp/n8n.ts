import { connectDB } from "@/lib/db/connect";
import { N8nRetry } from "@/lib/db/models/N8nRetry";
import type { ListingContext, HistoryMessage } from "@/lib/leads/context";

/**
 * n8n forwarding (DEV-SPEC.txt Section 11). We POST the inbound message +
 * context to N8N_WEBHOOK_URL, where the AI workflow qualifies the lead and
 * returns a reply. Failed calls are queued for retry so nothing is lost.
 */

/** Exact request payload shape from Section 11. */
export interface N8nRequest {
  phone: string;
  profileName?: string;
  message: string;
  messageId: string;
  listingId: string | null;
  listingContext: ListingContext | null;
  conversationHistory: HistoryMessage[];
  existingLead: Record<string, unknown> | null;
}

/** Fields the AI extracts (Section 11). All optional - the AI fills what it can. */
export interface N8nExtracted {
  name?: string;
  purpose?: string;
  propertyType?: string;
  bhk?: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  loanRequired?: boolean;
  cityName?: string;
  localityName?: string;
  siteVisitSlot?: string;
}

/** Exact response shape from Section 11. */
export interface N8nResponse {
  reply: string;
  extracted?: N8nExtracted;
  qualificationScore?: number;
  isQualified?: boolean;
  stage?: "greeting" | "qualifying" | "qualified" | "closing";
}

export function n8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_URL);
}

const TIMEOUT_MS = 15_000;

/**
 * Forward to n8n and return the parsed response. Throws on any failure so the
 * caller can enqueue a retry - it never partially processes.
 */
export async function forwardToN8n(payload: N8nRequest): Promise<N8nResponse> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) throw new Error("N8N_WEBHOOK_URL is not configured.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_API_KEY ? { "x-api-key": process.env.N8N_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`n8n ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as N8nResponse;
    if (typeof json?.reply !== "string") {
      throw new Error("n8n response missing a string `reply`.");
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Queue a failed forward for a later retry worker (idempotent by messageId). */
export async function enqueueN8nRetry(
  payload: N8nRequest,
  error: string,
): Promise<void> {
  try {
    await connectDB();
    await N8nRetry.updateOne(
      { messageId: payload.messageId },
      {
        $setOnInsert: { payload, phone: payload.phone, messageId: payload.messageId },
        $set: { lastError: error, nextAttemptAt: new Date(Date.now() + 60_000) },
        $inc: { attempts: 1 },
      },
      { upsert: true },
    );
  } catch {
    // Never throw from the webhook path.
  }
}
