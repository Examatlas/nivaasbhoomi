/**
 * WhatsApp Cloud API client (DEV-SPEC.txt Sections 3, 8, 11).
 *
 * Only the OTP template is needed for Phase 4. If the Cloud API env is not
 * configured, sending is a no-op that reports `configured: false` so the caller
 * can apply the documented dev fallback (return/log the OTP in development, fail
 * in production). We never throw from here - delivery failures are values.
 */

const GRAPH_VERSION = "v21.0";

export function whatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export interface SendResult {
  /** Whether the Cloud API is configured at all. */
  configured: boolean;
  /** Whether the message was accepted by the Cloud API. */
  delivered: boolean;
  error?: string;
}

/**
 * Send the `login_otp` authentication template. Authentication templates carry
 * the code in the body parameter AND in a one-time-password (copy-code) button,
 * so we pass it to both.
 */
export async function sendLoginOtp(phone: string, code: string): Promise<SendResult> {
  if (!whatsAppConfigured()) return { configured: false, delivered: false };

  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: "login_otp",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        configured: true,
        delivered: false,
        error: `WhatsApp API ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { configured: true, delivered: true };
  } catch (e) {
    return {
      configured: true,
      delivered: false,
      error: e instanceof Error ? e.message : "WhatsApp request failed",
    };
  }
}
