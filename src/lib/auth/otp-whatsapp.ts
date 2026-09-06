/**
 * Send a login OTP over the Meta WhatsApp Cloud API. This is the ONLY WhatsApp
 * call in the auth flow — no inbound webhook, no automation. The code goes into
 * BOTH the body parameter and the URL/copy-code button parameter, otherwise the
 * copy-code button arrives empty. Never returns or logs the raw OTP.
 */
const GRAPH_VERSION = "v21.0";

export interface OtpSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** false when the env vars aren't set (so the route can 502 clearly). */
  configured: boolean;
}

export async function sendOtpTemplate(canonicalPhone: string, code: string): Promise<OtpSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "login_otp";
  const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? "en";

  if (!phoneNumberId || !token) {
    return { ok: false, configured: false, error: "WhatsApp OTP not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing)." };
  }

  // Meta wants the E.164 number WITHOUT the leading "+": the canonical form is
  // exactly that ("91XXXXXXXXXX").
  const to = canonicalPhone;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as
      | { messages?: { id?: string }[]; error?: { message?: string } }
      | null;
    if (!res.ok) {
      return { ok: false, configured: true, error: `Meta ${res.status}: ${data?.error?.message ?? "send failed"}` };
    }
    return { ok: true, configured: true, messageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : "network error" };
  }
}
