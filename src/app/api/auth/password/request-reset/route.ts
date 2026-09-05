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
  const role = parsed.data.role as ResetRole;

  await connectDB();
  const account =
    role === "dealer"
      ? await Dealer.findOne({ email }, { _id: 1, passwordHash: 1 }).lean()
      : await User.findOne({ email }, { _id: 1, passwordHash: 1 }).lean();

  // Only accounts that actually have a password can reset one. Either way we
  // return the same generic response below.
  let devResetLink: string | undefined;
  if (account && account.passwordHash) {
    const issued = await issueReset(role, email);
    if (issued.ok && issued.token) {
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
      if (!result.delivered) {
        if (isDev) {
          console.warn(
            `[DEV RESET] Email ${result.configured ? "send failed" : "not configured"}. ` +
              `Reset link for ${email} (${role}): ${link}`,
          );
          devResetLink = link;
        } else if (!result.configured) {
          console.error(
            "[reset] RESEND_API_KEY / EMAIL_FROM not set — reset email could not be sent.",
          );
        }
      }
    }
  }

  return ok({
    requested: true,
    message: "If that email has an account, a reset link is on its way.",
    ...(devResetLink ? { devResetLink } : {}),
  });
});
