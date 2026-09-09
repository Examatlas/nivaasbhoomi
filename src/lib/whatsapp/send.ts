import { getAutomationSettings } from "@/lib/settings/automation";
import {
  sendText as metaSendText,
  sendTemplate as metaSendTemplate,
  type SendResult,
} from "@/lib/whatsapp/client";
import { zenithSendText, zenithSendTemplate } from "@/lib/whatsapp/zenith-client";
import { whatsAppProvider, isZenithEligible } from "@/lib/whatsapp/provider";
import { TEMPLATES, type TemplateName } from "@/lib/whatsapp/templates";

/**
 * Provider-aware sender for NivaasBhoomi's BUSINESS messages - the lead-related
 * ones the platform sends itself: lead_assigned, listing_expiry_warning,
 * review_request, site_visit_reminder.
 *
 * When the configured messaging provider is "zenith" these go through Zenith
 * Code's API; otherwise they use the Meta Cloud API path directly. The dealer
 * WhatsApp OTP LOGIN is deliberately NOT routed here - login stays on the
 * existing Meta path (Section 8; the integration is messaging only, not login).
 *
 * Default provider is "meta", so behaviour is unchanged until the admin flips to
 * Zenith on the Automation settings screen.
 */
export async function sendBusinessText(to: string, text: string): Promise<SendResult> {
  const { provider } = await getAutomationSettings();
  return provider === "zenith" ? zenithSendText(to, text) : metaSendText(to, text);
}

export async function sendBusinessTemplate<N extends TemplateName>(
  to: string,
  name: N,
  params: Parameters<(typeof TEMPLATES)[N]["build"]>[0],
): Promise<SendResult> {
  // Transport decision lives in ONE place: provider.isZenithEligible. Zenith's
  // template endpoint accepts only OTP-shape (code + customerName), so every
  // multi-variable business template (lead_assigned, property_alert,
  // listing_expiry_warning, review_request, …) is NOT eligible and always sends
  // via Meta. Only the login OTP is Zenith-eligible, and that path lives in
  // lib/auth/otp-whatsapp (Zenith-primary + Meta fallback).
  if (whatsAppProvider() === "zenith" && isZenithEligible(TEMPLATES[name].name)) {
    return zenithSendTemplate(to, name, params); // no business template qualifies today
  }
  return metaSendTemplate(to, name, params);
}
