import {
  sendText as metaSendText,
  sendTemplate as metaSendTemplate,
  type SendResult,
} from "@/lib/whatsapp/client";
import {
  sendZenithBusinessTemplate,
  sendZenithText,
  zenithConfigured,
} from "@/lib/whatsapp/zenith-otp";
import {
  whatsAppProvider,
  isZenithEligible,
  orchestrateOtpSend,
  type SendProvider,
} from "@/lib/whatsapp/provider";
import { TEMPLATES, toZenithParams, type TemplateName } from "@/lib/whatsapp/templates";

/**
 * Provider-aware sender for NivaasBhoomi's BUSINESS messages (lead_assigned,
 * property_alert, listing_expiry_warning, review_request, and the dealer
 * lifecycle notifications).
 *
 * Zenith is now PRIMARY: its /whatsapp/template endpoint supports multi-variable
 * templates (bodyParams + buttonParams — confirmed contract). When
 * WHATSAPP_PROVIDER=zenith and Zenith is configured, templates go via Zenith;
 * Meta remains ONLY as the automatic fallback on a Zenith 5xx / timeout /
 * network error (same rule as OTP: a 4xx except 422 does NOT fall back, since it
 * would fail on Meta too). If Meta creds are missing/expired the fallback simply
 * fails — that's acceptable and gets logged by the caller.
 *
 * The dealer WhatsApp OTP LOGIN is NOT routed here — it has its own
 * Zenith-primary + Meta-fallback path in lib/auth/otp-whatsapp.
 */

/** A send result plus WHICH transport actually delivered it (for logging). */
export interface BusinessSendResult extends SendResult {
  via: SendProvider;
  fellBack: boolean;
}

export async function sendBusinessTemplate<N extends TemplateName>(
  to: string,
  name: N,
  params: Parameters<(typeof TEMPLATES)[N]["build"]>[0],
): Promise<BusinessSendResult> {
  const tpl = TEMPLATES[name];
  const meta = () => metaSendTemplate(to, name, params);

  if (whatsAppProvider() === "zenith" && isZenithEligible(tpl.name)) {
    // Build + VALIDATE the Zenith body BEFORE any upstream call. A bad param
    // count / missing button is a clean internal error — no blind call, and we
    // do NOT silently fall through to Meta with a payload we know is wrong.
    let zbody;
    try {
      zbody = toZenithParams(name, params);
    } catch (e) {
      const error = e instanceof Error ? e.message : "invalid template params";
      console.warn(`[whatsapp] ${error}`);
      return { configured: true, delivered: false, error, via: "zenith", fellBack: false };
    }

    const { result, via, fellBack } = await orchestrateOtpSend({
      provider: "zenith",
      zenithReady: zenithConfigured(),
      sendZenith: async () => {
        const z = await sendZenithBusinessTemplate(to, zbody);
        return {
          ok: z.ok,
          status: z.status,
          messageId: z.messageId,
          error: z.ok ? undefined : [z.error, z.bodyText].filter(Boolean).join(" — "),
        };
      },
      sendMeta: async () => {
        const m = await meta();
        return { ok: m.delivered, messageId: m.messageId, error: m.error };
      },
      onFallback: (r) => console.warn(`[whatsapp] business fallback zenith → meta (${tpl.name}): ${r}`),
    });

    return {
      configured: true,
      delivered: result.ok,
      messageId: result.messageId,
      error: result.error,
      via,
      fellBack,
    };
  }

  const m = await meta();
  return { ...m, via: "meta", fellBack: false };
}

/**
 * Free-form text (only valid inside the 24-hour service window — e.g. the AI's
 * reply in the webhook). Same Zenith-primary + Meta-fallback routing.
 */
export async function sendBusinessText(to: string, text: string): Promise<BusinessSendResult> {
  const meta = () => metaSendText(to, text);

  if (whatsAppProvider() === "zenith") {
    const { result, via, fellBack } = await orchestrateOtpSend({
      provider: "zenith",
      zenithReady: zenithConfigured(),
      sendZenith: async () => {
        const z = await sendZenithText({ to, message: text });
        return {
          ok: z.ok,
          status: z.status,
          messageId: z.messageId,
          error: z.ok ? undefined : [z.error, z.bodyText].filter(Boolean).join(" — "),
        };
      },
      sendMeta: async () => {
        const m = await meta();
        return { ok: m.delivered, messageId: m.messageId, error: m.error };
      },
      onFallback: (r) => console.warn(`[whatsapp] free-form fallback zenith → meta: ${r}`),
    });
    return {
      configured: true,
      delivered: result.ok,
      messageId: result.messageId,
      error: result.error,
      via,
      fellBack,
    };
  }

  const m = await meta();
  return { ...m, via: "meta", fellBack: false };
}
