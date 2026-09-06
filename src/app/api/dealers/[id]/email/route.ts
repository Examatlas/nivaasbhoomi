import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { emailInUse } from "@/lib/auth/account-guards";
import { issueEmailChange } from "@/lib/auth/email-change";
import { sendEmail } from "@/lib/email/mailer";
import { SITE_URL, BRAND } from "@/lib/seo/site";

/**
 * POST /api/dealers/[id]/email   [dealer auth, self]
 *
 * Request an email change (or set an email for the first time). The new address
 * is NEVER written to the account here — it's stored as pendingEmail, and a
 * single-use verification link is emailed to the NEW address; the swap happens
 * only when that link is confirmed (POST /api/dealers/email/verify). A plain
 * notice also goes to the OLD address so a hijack attempt is visible. Rejected
 * if the email is already used by another Dealer or User.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/email">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only change your own email.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Enter a valid email address.");
    const newEmail = parsed.data.email;

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    if (dealer.email === newEmail) {
      return fail("VALIDATION_ERROR", "That is already your account email.");
    }
    if (await emailInUse(newEmail, id)) {
      return fail("DUPLICATE", "That email is already in use by another account.");
    }

    const issued = await issueEmailChange(id, newEmail);
    if (!issued.ok || !issued.token) {
      return fail(
        "RATE_LIMITED",
        `Too many requests. Try again in ${issued.retryAfterMinutes ?? 15} minutes.`,
      );
    }

    dealer.pendingEmail = newEmail;
    await dealer.save();

    // Public path (not gated by proxy.ts /dealer/*), so the dealer can confirm
    // from any device without being signed in — the token is the authorization.
    const link = `${SITE_URL}/verify-email?token=${issued.token}`;
    const oldEmail = dealer.email;

    // Verification link → the NEW address (proves the dealer controls it).
    await sendEmail({
      to: newEmail,
      subject: `Confirm your new ${BRAND} email`,
      text:
        `Confirm this address for your ${BRAND} account (link expires in 1 hour):\n${link}\n\n` +
        `If you didn't request this, you can ignore this email.`,
      html:
        `<p>Confirm this address for your ${BRAND} account.</p>` +
        `<p><a href="${link}">Confirm email change</a> (link expires in 1 hour).</p>` +
        `<p>If you didn't request this, you can safely ignore this email.</p>`,
    });

    // Security notice → the OLD address (if any), so a hijack is visible to the
    // real owner. Contains no link, so it can't itself be used to complete a change.
    if (oldEmail) {
      await sendEmail({
        to: oldEmail,
        subject: `${BRAND} email change requested`,
        text:
          `A change of your ${BRAND} account email to ${newEmail} was requested. If this was ` +
          `you, confirm from the link sent to the new address. If not, your account is ` +
          `unchanged — consider changing your password.`,
        html:
          `<p>A change of your ${BRAND} account email to <strong>${newEmail}</strong> was requested.</p>` +
          `<p>If this was you, confirm from the link sent to the new address. If not, your ` +
          `account is unchanged — consider changing your password.</p>`,
      });
    }

    return ok({ requested: true, pendingEmail: newEmail });
  },
);
