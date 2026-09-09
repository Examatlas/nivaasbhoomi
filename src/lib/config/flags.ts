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

/**
 * Self-signup dealer status. Default: a newly-registered dealer is ACTIVE
 * immediately (they get the dashboard + can create listings) — but stays at
 * verificationTier 0, so their listings never go live until an admin verifies
 * their documents (that gate is separate and unchanged). Set
 * DEALER_SIGNUP_ACTIVE=false to go back to requiring admin approval (status
 * "pending") without a code change.
 */
export function dealerSelfSignupActive(): boolean {
  return process.env.DEALER_SIGNUP_ACTIVE !== "false";
}

/** The status a self-signup / buyer-upgrade dealer is created with. */
export function dealerSignupStatus(): "active" | "pending" {
  return dealerSelfSignupActive() ? "active" : "pending";
}

/**
 * How buyers AND dealers authenticate. Switchable without a rewrite:
 *
 *   "password"  — email + password (bcrypt). The LAUNCH default: it works today
 *                 with no third-party approval. The signup form also captures
 *                 the user's phone (stored, not verified) so the dealer gets a
 *                 number to call.
 *   "whatsapp"  — WhatsApp OTP (needs a verified Meta app + approved template).
 *   "sms"       — SMS OTP (needs DLT registration). Reserved; no sender wired
 *                 yet, so the login screens show "not available" if selected.
 *
 * Every auth route is gated on this, so the dormant methods stay intact but
 * inert until you flip AUTH_METHOD once the approvals come through.
 */
export type AuthMethod = "password" | "sms" | "whatsapp";

export function authMethod(): AuthMethod {
  const v = process.env.AUTH_METHOD;
  if (v === "sms" || v === "whatsapp") return v;
  return "password";
}

/**
 * Dealer lifecycle WhatsApp notifications (dealer_approved, listing_approved,
 * listing_rejected). ON by default. Set DEALER_NOTIFICATIONS_ENABLED=false to
 * silence all three instantly — without a deploy — if something misbehaves
 * (e.g. a template gets paused by Meta). Admin actions are unaffected either
 * way; notifications are best-effort.
 */
export function dealerNotificationsEnabled(): boolean {
  return process.env.DEALER_NOTIFICATIONS_ENABLED !== "false";
}
