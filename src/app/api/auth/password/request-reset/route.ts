import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { issueReset, type ResetRole } from "@/lib/auth/password-reset";
import { sendEmail, emailConfigured } from "@/lib/email/mailer";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { SITE_URL, BRAND } from "@/lib/seo/site";
import { escapeRegExp } from "@/lib/api/pagination";

/**
 * POST /api/auth/password/request-reset   { email, role }
 *
 * Emails a single-use reset link to the account owner. ALWAYS returns a generic
 * success — it never reveals whether an email is registered (no enumeration).
 * If email isn't configured, in development it returns the link so recovery is
 * testable without a provider; in production it silently succeeds (and logs that
 * email is unconfigured) so behaviour is still non-revealing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";

/** Mask an email for logs: "sujit@gmail.com" -> "su***@gmail.com". Password-reset
 *  attempts tied to a full address are sensitive; Vercel logs are broadly visible. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200),
  role: z.enum(["user", "dealer"]).default("user"),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (authMethod() !== "password") {
    return fail("FORBIDDEN", "Password reset is only available for email/password login.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "A valid email is required.");
  }

  const { email } = parsed.data;
  const requestedRole = parsed.data.role as ResetRole;
  const masked = maskEmail(email);

  await connectDB();

  // Look up BOTH account spaces — never let the client-supplied role decide
  // whether an account exists. Case-insensitive exact match (anchored + escaped)
  // so a legacy row stored with different case (written outside the Mongoose
  // lowercase setter) still matches the normalized lookup.
  const emailRx = new RegExp(`^${escapeRegExp(email)}$`, "i");
  const [userAccount, dealerAccount] = await Promise.all([
    User.findOne({ email: emailRx }, { _id: 1, email: 1, passwordHash: 1 }).lean(),
    Dealer.findOne({ email: emailRx }, { _id: 1, email: 1, passwordHash: 1 }).lean(),
  ]);
  const userFound = Boolean(userAccount);
  const dealerFound = Boolean(dealerAccount);

  // Resolve which account to act on: honour the requested role when THAT account
  // EXISTS, else fall back to whichever type exists. Note we resolve on existence,
  // not on having a password — an account without one gets a SET-password email
  // (below), never a silent skip. If an email is both, the requested role wins.
  let role: ResetRole | null = null;
  let account: { email?: string | null; passwordHash?: string | null } | null = null;
  if (requestedRole === "dealer" && dealerFound) { role = "dealer"; account = dealerAccount; }
  else if (requestedRole === "user" && userFound) { role = "user"; account = userAccount; }
  else if (dealerFound) { role = "dealer"; account = dealerAccount; }
  else if (userFound) { role = "user"; account = userAccount; }

  let devResetLink: string | undefined;
  if (!role || !account) {
    // Surfaced at WARN so it appears under Vercel's warning filter, with enough
    // detail to tell "no account" from "wrong email" — but never the raw address.
    console.warn(
      `[reset] no match email=${masked} requested=${requestedRole} ` +
        `userFound=${userFound} userHasPw=${Boolean(userAccount?.passwordHash)} ` +
        `dealerFound=${dealerFound} dealerHasPw=${Boolean(dealerAccount?.passwordHash)}`,
    );
  } else {
    // "set" = the account has no password yet (e.g. a dealer created via the
    // WhatsApp-OTP flow before the email/password switch). They are NOT locked
    // out — the same token flow lets them set a password for the first time.
    const mode: "reset" | "set" = account.passwordHash ? "reset" : "set";
    // Use the account's STORED email so the confirm route's lookup matches exactly.
    const acctEmail = account.email ?? email;
    const issued = await issueReset(role, acctEmail);
    if (issued.ok && issued.token) {
      // The resolved role is stamped into BOTH the link and the token row, so a
      // dealer reset lands on the dealer flow; a tampered ?role= fails the confirm.
      const link = `${SITE_URL}/reset-password?token=${issued.token}&role=${role}`;
      const subject =
        mode === "set" ? `Set your ${BRAND} password` : `Reset your ${BRAND} password`;
      const text =
        mode === "set"
          ? `You can set a password for your ${BRAND} account here (link expires in 1 hour):\n${link}\n\n` +
            `If you didn't ask for this, you can ignore this email.`
          : `We received a request to reset your ${BRAND} password.\n\n` +
            `Reset it here (link expires in 1 hour):\n${link}\n\n` +
            `If you didn't ask for this, you can ignore this email.`;
      const html =
        mode === "set"
          ? `<p>You can set a password for your ${BRAND} account.</p>` +
            `<p><a href="${link}">Set your password</a> (link expires in 1 hour).</p>` +
            `<p>If you didn't ask for this, you can safely ignore this email.</p>`
          : `<p>We received a request to reset your ${BRAND} password.</p>` +
            `<p><a href="${link}">Reset your password</a> (link expires in 1 hour).</p>` +
            `<p>If you didn't ask for this, you can safely ignore this email.</p>`;

      const result = await sendEmail({ to: acctEmail, subject, html, text });
      if (result.delivered) {
        console.info(`[reset] email SENT mode=${mode} role=${role} to=${masked} resendId=${result.id ?? "unknown"}`);
      } else if (!result.configured) {
        console.error("[reset] email NOT configured (RESEND_API_KEY / EMAIL_FROM missing) — nothing sent.");
      } else {
        console.error(`[reset] email send FAILED mode=${mode} role=${role} to=${masked}: ${result.error ?? "unknown error"}`);
      }
      if (!result.delivered && isDev) {
        console.warn(`[DEV RESET] ${mode} link for ${masked} (${role}): ${link}`);
        devResetLink = link;
      }
    } else if (!issued.ok) {
      console.warn(`[reset] rate-limited role=${role} email=${masked}`);
    }
  }

  return ok({
    requested: true,
    message: "If that email has an account, a reset link is on its way.",
    ...(devResetLink ? { devResetLink } : {}),
  });
});
