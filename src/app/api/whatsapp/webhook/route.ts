import { after, type NextRequest } from "next/server";

import { verifyWebhookSignature } from "@/lib/whatsapp/signature";
import { getAutomationSettings } from "@/lib/settings/automation";
import { processInboundMessage, type InboundEvent } from "@/lib/whatsapp/webhook-process";

/**
 * WhatsApp Cloud API webhook (DEV-SPEC.txt Section 11).
 *
 * GET  - Meta's verification handshake (hub.verify_token vs WHATSAPP_VERIFY_TOKEN).
 * POST - inbound messages:
 *   1. Verify X-Hub-Signature-256 (HMAC-SHA256 / WHATSAPP_APP_SECRET) -> 403 on fail
 *   2. Return 200 IMMEDIATELY (Meta times out at 20s)
 *   3. Process asynchronously via `after()` - NEVER throw, always 200
 *
 * Node runtime: signature verification uses node:crypto.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- GET: verification challenge ----
export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

// ---- POST: inbound messages ----
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 1. Signature check FIRST - reject anything we can't verify.
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    return new Response("Invalid signature", { status: 403 });
  }

  // 2. DORMANT when Zenith Code is the provider: NivaasBhoomi no longer runs its
  //    own Meta+n8n qualification (Zenith does it and pushes leads to
  //    /api/leads/ingest). We still ACK 200 so Meta stays happy, but skip all
  //    processing. Flip the provider back to "meta" to re-activate this path.
  const { provider } = await getAutomationSettings();
  if (provider === "zenith") {
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  // 3. Extract events synchronously (cheap), but do all real work after 200.
  const events = extractEvents(raw);

  if (events.length > 0) {
    after(async () => {
      for (const evt of events) {
        // processInboundMessage never throws; guard anyway so one bad message
        // can't stop the rest.
        try {
          await processInboundMessage(evt);
        } catch {
          /* swallowed - webhook must never surface an error to Meta */
        }
      }
    });
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}

/** Parse the Meta webhook body into our inbound events (text messages only). */
function extractEvents(raw: string): InboundEvent[] {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: InboundEvent[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;

      // Buyer display name from the contacts array.
      const contacts = value.contacts as { profile?: { name?: string } }[] | undefined;
      const profileName = contacts?.[0]?.profile?.name;

      const messages = value.messages as
        | { from?: string; id?: string; type?: string; text?: { body?: string } }[]
        | undefined;
      if (!Array.isArray(messages)) continue; // status receipts etc. -> ignore

      for (const m of messages) {
        // Only text messages carry an enquiry today.
        const text = m.type === "text" ? (m.text?.body ?? "") : "";
        if (!m.from || !m.id) continue;
        out.push({
          from: m.from,
          messageId: m.id,
          text,
          profileName,
        });
      }
    }
  }
  return out;
}
