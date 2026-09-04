/**
 * Launch feature flags. Standalone (no DB / no Node-only imports) so it is safe
 * to use from the Edge proxy as well as server routes and pages.
 */

/**
 * Dealer self-login (WhatsApp OTP + the dealer panel). OFF by default so the
 * launch build ships with it parked: the OTP isn't wired to a live WhatsApp
 * sender yet, so instead of a broken login the dealer routes show a "coming
 * soon" page and the admin works all leads. Set DEALER_LOGIN_ENABLED=true to
 * turn the dealer panel on (the Zenith / WhatsApp phase).
 */
export function dealerLoginEnabled(): boolean {
  return process.env.DEALER_LOGIN_ENABLED === "true";
}
