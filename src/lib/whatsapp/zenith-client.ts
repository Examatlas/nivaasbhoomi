import { connectDB } from "@/lib/db/connect";
import { DeadLetter } from "@/lib/db/models/DeadLetter";
import { TEMPLATES, type TemplateName } from "@/lib/whatsapp/templates";
import { getAutomationSettings } from "@/lib/settings/automation";
import type { SendResult } from "@/lib/whatsapp/client";

/**
 * Zenith Code send adapter (outbound). Sends the lead-related messages
 * (lead_assigned, listing_expiry_warning, review_request, site_visit_reminder)
 * through Zenith's WhatsApp API instead of Meta directly.
 *
 * ⚠️ REQUEST SHAPE IS UNVERIFIED. The Zenith developer docs are behind the
 * account login and could not be read, so the exact endpoint path, auth header
 * and body below are a reasonable ASSUMPTION and MUST be confirmed against the
 * Zenith docs before enabling `provider: "zenith"`. Everything is isolated in
 * `zenithRequest()` so confirming it is a one-function change. Failures still go
 * to the DeadLetter collection, same as the Meta path. Never throws.
 */

const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ZenithMessage {
  to: string;
  kind: "text" | "template";
  text?: string;
  templateName?: string;
  templateParams?: Record<string, unknown>;
}

/**
 * The single place that knows Zenith's HTTP contract. ASSUMED until confirmed:
 *   POST {baseUrl}/messages
 *   Authorization: Bearer <apiKey>
 *   { accountId?, to, type, text? , template? }
 */
async function zenithRequest(msg: ZenithMessage): Promise<SendResult> {
  const { zenithApiKey, zenithBaseUrl, zenithAccountId } = await getAutomationSettings();
  if (!zenithApiKey || !zenithBaseUrl) {
    return { configured: false, delivered: false };
  }
  const url = `${zenithBaseUrl.replace(/\/+$/, "")}/messages`;

  const body: Record<string, unknown> = {
    ...(zenithAccountId ? { accountId: zenithAccountId } : {}),
    to: msg.to,
    type: msg.kind,
  };
  if (msg.kind === "text") body.text = msg.text;
  if (msg.kind === "template") {
    body.template = { name: msg.templateName, params: msg.templateParams };
  }

  let lastError = "unknown error";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${zenithApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string };
        return { configured: true, delivered: true, messageId: json.id ?? json.messageId };
      }
      const text = await res.text().catch(() => "");
      lastError = `Zenith API ${res.status}: ${text.slice(0, 300)}`;
      const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
      if (!retryable || attempt === MAX_RETRIES) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Zenith request failed";
      if (attempt === MAX_RETRIES) break;
    }
    await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 200));
  }

  await deadLetter(msg, lastError);
  return { configured: true, delivered: false, error: lastError, deadLettered: true };
}

async function deadLetter(msg: ZenithMessage, lastError: string): Promise<void> {
  try {
    await connectDB();
    await DeadLetter.create({
      channel: "zenith",
      to: msg.to,
      kind: msg.kind,
      templateName: msg.templateName,
      payload: msg,
      lastError,
      attempts: MAX_RETRIES + 1,
    });
  } catch {
    /* best-effort */
  }
}

export function zenithSendText(to: string, text: string): Promise<SendResult> {
  return zenithRequest({ to, kind: "text", text });
}

export function zenithSendTemplate<N extends TemplateName>(
  to: string,
  name: N,
  params: Parameters<(typeof TEMPLATES)[N]["build"]>[0],
): Promise<SendResult> {
  const tpl = TEMPLATES[name];
  return zenithRequest({
    to,
    kind: "template",
    templateName: tpl.name,
    templateParams: params as unknown as Record<string, unknown>,
  });
}
