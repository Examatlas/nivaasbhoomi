/**
 * Pure client-safe logic for the OTP verify screen (no React, no I/O) so the
 * "every branch goes somewhere" and "no double submit" rules are unit-tested.
 *
 * Verify SUCCESS responses (see /api/auth/otp/verify) come in these shapes:
 *   • existing dealer            → { role:"dealer", redirect:"/dealer/dashboard" }
 *   • buyer / linked buyer       → { role:"user",   redirect:"/" }
 *   • verified number, NO dealer → { role:"user", needsRegistration:true,
 *                                    redirect:"/dealer/register" }
 * Anything without a redirect is treated as an error rather than silently
 * leaving the user stranded on the OTP screen.
 */
export interface VerifyResponse {
  redirect?: string;
  needsRegistration?: boolean;
}

export type VerifyNav =
  | { kind: "register"; to: string } // new dealer → shared registration form
  | { kind: "navigate"; to: string } // existing dealer / buyer → their home
  | { kind: "error" }; // unknown / malformed success — show an error, never hang

/** Map a verify success response to exactly one navigation action. The dealer
 *  self-registration redirect always wins over `next` (they must register
 *  first); every other success honours `next` when present. */
export function verifyNavigation(
  res: VerifyResponse | null | undefined,
  opts: { next?: string | null } = {},
): VerifyNav {
  if (!res) return { kind: "error" };
  if (res.needsRegistration && res.redirect) return { kind: "register", to: res.redirect };
  if (res.redirect) return { kind: "navigate", to: opts.next || res.redirect };
  return { kind: "error" };
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
