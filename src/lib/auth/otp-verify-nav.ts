/**
 * Pure client-safe logic for the OTP verify screen (no React, no I/O).
 *
 * ROUTING IS DECIDED ON THE SERVER. /api/auth/otp/verify inspects the DB and
 * returns exactly where to go as `next` (plus a `mode` for the registration
 * screen); the client does NOT branch on account state — it just follows `next`.
 * Success responses:
 *   • existing dealer            → { next: "/dealer/dashboard" }
 *   • user exists, NO dealer     → { next: "/dealer/register?mode=upgrade", mode:"upgrade" }
 *   • neither (user created)     → { next: "/dealer/register?mode=new",     mode:"new" }
 *   • buyer login                → { next: "/" (or a safe ?next) }
 * A response with no usable `next` is treated as an error rather than silently
 * leaving the user stranded on the OTP screen.
 */
export interface VerifyResponse {
  next?: string;
  mode?: "upgrade" | "new";
}

/**
 * Guard a redirect target: allow ONLY a same-origin absolute path (a single
 * leading "/"). Blocks protocol-relative ("//evil"), absolute URLs (with a
 * scheme) and backslash tricks, so a `?next` can never become an open redirect.
 * Shared by the server (sanitising the client-supplied next) and the client
 * (before navigating). Returns null when empty or unsafe.
 */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (!path.startsWith("/")) return null; // must be a root-relative path
  if (path.startsWith("//")) return null; // protocol-relative → other origin
  if (path.includes("\\")) return null; // backslash normalises to "/" in browsers
  return path;
}

/** The register-branch destination when an OTP-verified number has NO dealer:
 *  "upgrade" links an existing buyer User, "new" was just created. The `mode`
 *  rides in the path so /dealer/register can show the right notice. */
export function dealerRegisterNext(userExists: boolean): {
  next: string;
  mode: "upgrade" | "new";
} {
  const mode = userExists ? "upgrade" : "new";
  return { next: `/dealer/register?mode=${mode}`, mode };
}

/** A submit may proceed only when nothing is in flight, the code hasn't already
 *  been verified, and all six digits are present. Both the auto-submit (6th
 *  digit) and the manual button run through this, so a double submit — which
 *  would burn the one-time OTP on the first request and fail the second — can't
 *  happen. */
export function canSubmitOtp(opts: {
  inFlight: boolean;
  verified: boolean;
  codeLength: number;
}): boolean {
  return !opts.inFlight && !opts.verified && opts.codeLength === 6;
}
