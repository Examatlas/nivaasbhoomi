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
  // whether an account exists. A dealer whose request arrives with the default
  // role="user" (e.g. a generic forgot-password entry) must still be found.
  const [userAccount, dealerAccount] = await Promise.all([
    User.findOne({ email }, { _id: 1, passwordHash: 1 }).lean(),
    Dealer.findOne({ email }, { _id: 1, passwordHash: 1 }).lean(),
  ]);
  const userOk = Boolean(userAccount?.passwordHash);
  const dealerOk = Boolean(dealerAccount?.passwordHash);

  // Resolve which account to reset: honour the requested role when THAT account
  // exists, else fall back to whichever type actually has one. If an email is
  // both a buyer and a dealer, the requested role wins.
  let role: ResetRole | null = null;
  if (requestedRole === "dealer" && dealerOk) role = "dealer";
  else if (requestedRole === "user" && userOk) role = "user";
  else if (dealerOk) role = "dealer";
  else if (userOk) role = "user";

  // Server log only — the HTTP response stays generic (anti-enumeration). Email
  // is masked; never log the raw address or the reset token.
  console.info(`[reset] request email=${masked} requested=${requestedRole} match=${role ?? "none"}`);

  let devResetLink: string | undefined;
  if (role) {
    const issued = await issueReset(role, email);
    if (issued.ok && issued.token) {
      // The resolved role is stamped into BOTH the link and the token row, so a
      // dealer reset lands on the dealer flow; a tampered ?role= fails the confirm.
      const link = `${SITE_URL}/reset-password?token=${issued.token}&role=${role}`;
      const subject = `Reset your ${BRAND} password`;
      const text =
        `We received a request to reset your ${BRAND} password.\n\n` +
        `Reset it here (link expires in 1 hour):\n${link}\n\n` +
        `If you didn't ask for this, you can ignore this email.`;
      const html =
        `<p>We received a request to reset your ${BRAND} password.</p>` +
        `<p><a href="${link}">Reset your password</a> (link expires in 1 hour).</p>` +
        `<p>If you didn't ask for this, you can safely ignore this email.</p>`;

      const result = await sendEmail({ to: email, subject, html, text });
      if (result.delivered) {
        console.info(`[reset] email SENT role=${role} to=${masked} resendId=${result.id ?? "unknown"}`);
      } else if (!result.configured) {
        console.error("[reset] email NOT configured (RESEND_API_KEY / EMAIL_FROM missing) — nothing sent.");
      } else {
        // configured but Resend rejected — previously swallowed in production.
        console.error(`[reset] email send FAILED role=${role} to=${masked}: ${result.error ?? "unknown error"}`);
      }
      if (!result.delivered && isDev) {
        console.warn(`[DEV RESET] Reset link for ${masked} (${role}): ${link}`);
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
