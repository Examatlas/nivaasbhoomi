import { sendZenithTemplate, zenithConfigured } from "@/lib/whatsapp/zenith-otp";
import {
  whatsAppProvider,
  orchestrateOtpSend,
  recordWhatsAppSend,
} from "@/lib/whatsapp/provider";

/**
 * Send a login OTP over WhatsApp. Transport is provider-aware:
 *   WHATSAPP_PROVIDER=zenith → Zenith Code (confirmed contract), with an
 *     AUTOMATIC fallback to Meta on timeout / 5xx / network (login is OTP-only,
 *     so Zenith being down must never take the whole login down). A 4xx does
 *     NOT fall back (a bad template/number fails on Meta too).
 *   WHATSAPP_PROVIDER=meta (default) → Meta Cloud API directly (rollback path).
 *
 * The public interface (sendOtpTemplate(phone, code) → OtpSendResult) is
 * unchanged, so the OTP route/rate-limit/dedup/cooldown behaviour is untouched.
 * Never returns or logs the raw OTP.
 */
const GRAPH_VERSION = "v21.0";
const OTP_TEMPLATE = () => process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "login_otp";

export interface OtpSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** false when the env vars aren't set (so the route can 502 clearly). */
  configured: boolean;
}

/** Meta Cloud API OTP send — the fallback path and the default transport. */
async function sendOtpViaMeta(canonicalPhone: string, code: string): Promise<OtpSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = OTP_TEMPLATE();
  const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? "en";

  if (!phoneNumberId || !token) {
    return {
      ok: false,
      configured: false,
      error: "WhatsApp OTP not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing).",
    };
  }

  // Meta wants the E.164 number WITHOUT the leading "+": canonical form is
  // exactly that ("91XXXXXXXXXX"). Strip any stray non-digits defensively.
  const to = canonicalPhone.replace(/\D/g, "");

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

export async function sendOtpTemplate(canonicalPhone: string, code: string): Promise<OtpSendResult> {
  const template = OTP_TEMPLATE();
  let metaResult: OtpSendResult | null = null;

  const { result, via, fellBack } = await orchestrateOtpSend({
    provider: whatsAppProvider(),
    zenithReady: zenithConfigured(),
    sendZenith: async () => {
      let z;
      try {
        z = await sendZenithTemplate({ to: canonicalPhone, code });
      } catch (e) {
        // A required field was empty — the adapter threw before calling Zenith.
        // Treat as transient (no status) so login falls back to Meta, and log
        // the clear field-named reason.
        const msg = e instanceof Error ? e.message : "Zenith adapter error";
        console.warn("[whatsapp] Zenith OTP adapter error:", msg);
        return { ok: false, error: msg };
      }
      // On failure, log Zenith's FULL response body (status + text) for triage.
      if (!z.ok) {
        console.warn(
          "[whatsapp] Zenith OTP send failed:",
          JSON.stringify({ status: z.status, error: z.error, body: z.bodyText, timedOut: z.timedOut }),
        );
      }
      // VISIBILITY: carry Zenith's response BODY up the stack (not just
      // "Zenith <status>"), so the route's `[otp] send FAILED` log AND the
      // WhatsAppSendLog row capture the real reason (e.g. "Invalid API key",
      // a template/language rejection). Server-side only — the client still
      // gets the generic message.
      return {
        ok: z.ok,
        status: z.status,
        messageId: z.messageId,
        error: z.ok ? undefined : [z.error, z.bodyText].filter(Boolean).join(" — "),
      };
    },
    sendMeta: async () => {
      metaResult = await sendOtpViaMeta(canonicalPhone, code);
      return { ok: metaResult.ok, messageId: metaResult.messageId, error: metaResult.error };
    },
    onFallback: (reason) =>
      console.warn(`[whatsapp] OTP fallback zenith → meta (${template}): ${reason}`),
  });

  await recordWhatsAppSend({
    provider: via,
    template,
    delivered: result.ok,
    status: result.status,
    messageId: result.messageId,
    error: result.error,
    fellBack,
  });

  // Preserve the OtpSendResult contract. When the Meta path ran, carry its
  // `configured` flag (false only when Meta env is missing); a Zenith send is
  // reached only when Zenith is configured, so it's `configured: true`.
  const configured =
    via === "zenith" ? true : ((metaResult as OtpSendResult | null)?.configured ?? true);
  return { ok: result.ok, messageId: result.messageId, error: result.error, configured };
}
