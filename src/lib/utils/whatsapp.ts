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
  /** Portal WhatsApp number (NEXT_PUBLIC_WHATSAPP_NUMBER). */
  phone: string;
  /** The listing's _id - carried as the hidden [Ref: xxx] tag for the AI. */
  listingId: string;
  title: string;
  slug: string;
  siteUrl?: string;
}

/**
 * The exact enquiry message a buyer sends from a PropertyCard or the property
 * page (DEV-SPEC.txt Section 11 - CTA LINK FORMAT):
 *
 *   Hi, mujhe ye property dekhni hai:
 *   {title}
 *   {SITE_URL}/property/{slug}
 *   [Ref: {listingId}]
 *
 * The [Ref: {listingId}] tag is how the WhatsApp webhook attributes the lead to
 * a listing, so it must be the listing _id and match the webhook's parser.
 */
export function buildListingEnquiry({
  phone,
  listingId,
  title,
  slug,
  siteUrl = "",
}: ListingEnquiry): string {
  const base = (siteUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/property/${slug}` : `/property/${slug}`;
  const message = [
    "Hi, mujhe ye property dekhni hai:",
    title,
    url,
    `[Ref: ${listingId}]`,
  ].join("\n");
  return buildWhatsAppLink({ phone, message });
}
