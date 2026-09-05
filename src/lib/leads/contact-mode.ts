/**
 * The property "Contact" button has two modes, chosen PER DEALER so we can flip
 * one dealer at a time without touching the button or the pages:
 *
 *   "contact"  — default. A signed-in buyer taps "Contact Us"; we create a lead
 *                (with the listing Ref) that lands in the dealer's dashboard.
 *                The dealer contacts the buyer.
 *
 *   "whatsapp" — LATER, once the dealer's WhatsApp number is verified as
 *                registered on Zenith Code. The button becomes a WhatsApp button
 *                that routes the buyer straight into the dealer's Zenith
 *                automation. Not built yet — no dealer is Zenith-connected.
 *
 * At launch every dealer resolves to "contact" because zenithConnected is false.
 */
export type ContactMode = "contact" | "whatsapp";

export function resolveContactMode(
  dealer: { zenithConnected?: boolean | null } | null | undefined,
): ContactMode {
  return dealer?.zenithConnected ? "whatsapp" : "contact";
}
