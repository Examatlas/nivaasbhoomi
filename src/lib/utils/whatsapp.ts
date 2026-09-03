/**
 * WhatsApp deep links.
 *
 * Every buyer contact on NivaasBhoomi goes through WhatsApp - there is no
 * "call now", no lead form, no phone-number popup (DEV-SPEC.txt design brief).
 * So this helper is on the critical path for the whole business and has to be
 * boringly correct.
 *
 * We build wa.me links because they work identically in the WhatsApp app and
 * on WhatsApp Web, and never expose the buyer's number the way a tel: link can.
 */

/** Strip everything but digits, drop a leading 0, default to India (91). */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface WhatsAppLinkParams {
  /** Portal display number (NEXT_PUBLIC_WHATSAPP_NUMBER), or a dealer number. */
  phone: string;
  /** Pre-filled first message. */
  message?: string;
  /**
   * Listing reference. Passed through so the WhatsApp webhook and n8n can
   * attribute the resulting lead to a listing (DEV-SPEC.txt Section 11: the
   * webhook parses listingId from the Ref tag).
   */
  ref?: string;
}

export function buildWhatsAppLink({ phone, message, ref }: WhatsAppLinkParams): string {
  const target = normalisePhone(phone);
  const parts: string[] = [];

  if (message) {
    const body = ref ? `${message}\n\nRef: ${ref}` : message;
    parts.push(`text=${encodeURIComponent(body)}`);
  }

  const query = parts.length > 0 ? `?${parts.join("&")}` : "";
  return `https://wa.me/${target}${query}`;
}

export interface ListingEnquiry {
  phone: string;
  title: string;
  slug: string;
  siteUrl?: string;
}

/**
 * The exact message a buyer sends from a PropertyCard or property page.
 * Includes the listing URL so the dealer has full context in their first
 * WhatsApp reply, and carries the slug as the Ref tag for lead routing.
 */
export function buildListingEnquiry({
  phone,
  title,
  slug,
  siteUrl = "",
}: ListingEnquiry): string {
  const url = siteUrl ? `${siteUrl.replace(/\/$/, "")}/property/${slug}` : "";
  const lines = [`Hi, I'm interested in this property:`, title];
  if (url) lines.push(url);
  return buildWhatsAppLink({
    phone,
    message: lines.join("\n"),
    ref: slug,
  });
}
