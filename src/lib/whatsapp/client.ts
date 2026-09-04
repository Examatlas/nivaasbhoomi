import { connectDB } from "@/lib/db/connect";
import { DeadLetter } from "@/lib/db/models/DeadLetter";
import { TEMPLATES, type TemplateName } from "@/lib/whatsapp/templates";

/**
 * WhatsApp Cloud API client (DEV-SPEC.txt Sections 3, 8, 11).
 *
 *  - sendText     free-form message, only valid INSIDE the 24-hour window
 *  - sendTemplate approved template, valid OUTSIDE the window
 *  - Exponential backoff on 429 / 5xx, max 3 retries
 *  - On final failure the payload goes to the DeadLetter collection for the
 *    admin dashboard (Section 11) - we never throw; failures are values.
 *
 * If the Cloud API env is not configured, sending is a no-op reporting
 * `configured: false` so callers can apply a documented dev fallback.
 */

const GRAPH_VERSION = "v21.0";
const MAX_RETRIES = 3; // retries AFTER the first attempt

export function whatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export interface SendResult {
  configured: boolean;
  delivered: boolean;
  messageId?: string;
  error?: string;
  /** True when the payload was written to the dead-letter collection. */
  deadLettered?: boolean;
}

interface WhatsAppPayload {
  messaging_product: "whatsapp";
  to: string;
  [k: string]: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retryable Cloud API failures: rate limit + transient server errors. */
function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

async function deadLetter(
  to: string,
  kind: "text" | "template",
  payload: WhatsAppPayload,
  lastError: string,
  attempts: number,
  templateName?: string,
): Promise<void> {
  try {
    await connectDB();
    await DeadLetter.create({ to, kind, templateName, payload, lastError, attempts });
  } catch {
    // Best-effort: if even the dead-letter write fails, we've still logged the
    // error to the caller's SendResult - don't throw from the client.
  }
}

/**
 * POST a message payload with exponential backoff, then dead-letter on failure.
 * `kind`/`templateName` are only used to label a dead-letter entry.
 */
async function send(
  payload: WhatsAppPayload,
  kind: "text" | "template",
  templateName?: string,
): Promise<SendResult> {
  if (!whatsAppConfigured()) return { configured: false, delivered: false };

  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  let lastError = "unknown error";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          messages?: { id?: string }[];
        };
        return {
          configured: true,
          delivered: true,
          messageId: json.messages?.[0]?.id,
        };
      }

      const text = await res.text().catch(() => "");
      lastError = `WhatsApp API ${res.status}: ${text.slice(0, 300)}`;

      if (!isRetryable(res.status) || attempt === MAX_RETRIES) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "WhatsApp request failed";
      if (attempt === MAX_RETRIES) break;
    }
    // Exponential backoff: 0.5s, 1s, 2s (+ jitter).
    await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 200));
  }

  await deadLetter(payload.to, kind, payload, lastError, MAX_RETRIES + 1, templateName);
  return { configured: true, delivered: false, error: lastError, deadLettered: true };
}

/** Free-form text message - valid only inside the 24-hour service window. */
export async function sendText(to: string, textBody: string): Promise<SendResult> {
  return send(
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: textBody, preview_url: false },
    },
    "text",
  );
}

/** Approved template message - valid outside the 24-hour window. */
export async function sendTemplate<N extends TemplateName>(
  to: string,
  name: N,
  params: Parameters<(typeof TEMPLATES)[N]["build"]>[0],
  languageOverride?: string,
): Promise<SendResult> {
  const tpl = TEMPLATES[name];
  const components = tpl.build(params as never);
  return send(
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.name,
        language: { code: languageOverride ?? tpl.language },
        components,
      },
    },
    "template",
    tpl.name,
  );
}

/** Convenience wrapper kept for the dealer OTP route (Phase 4). */
export function sendLoginOtp(phone: string, code: string): Promise<SendResult> {
  return sendTemplate(phone, "login_otp", { code });
}
