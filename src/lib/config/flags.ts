/**
 * Launch feature flags. Standalone (no DB / no Node-only imports) so it is safe
 * to use from the Edge proxy as well as server routes and pages.
 */

/**
 * Dealer self-login (WhatsApp OTP + the dealer panel). ON by default now that
 * NivaasBhoomi ships its own WhatsApp OTP (its own Meta app): dealers sign in
 * with an OTP, see their routed leads, and reach the Automation section. The
 * flag remains as a kill switch — set DEALER_LOGIN_ENABLED=false to park the
 * dealer panel again (login shows "coming soon", deeper routes redirect to it).
 */
export function dealerLoginEnabled(): boolean {
  return process.env.DEALER_LOGIN_ENABLED !== "false";
}
