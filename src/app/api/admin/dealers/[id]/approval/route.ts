import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { sendEmail } from "@/lib/email/mailer";
import { BRAND } from "@/lib/seo/site";

/**
 * POST /api/admin/dealers/[id]/approval   [admin]
 *   body: { action: "approve" | "reject", reason? }
 *
 * The self-signup approval gate. Approve → status "active" (routing + listings
 * unlocked). Reject → status "rejected" + stored reason. Either way the dealer
 * is emailed the outcome (best-effort; OTP-only dealers may have no email).
 * Only a pending (or, for approve, a previously-rejected) dealer can be acted on.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/dealers/[id]/approval">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("VALIDATION_ERROR", "Invalid dealer id.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Invalid approval request.");
    const { action, reason } = parsed.data;

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    // Only signup-gate states can be approved/rejected — never an active/paused/
    // banned account (those are managed via the force-edit route).
    const gateStates = new Set(["pending", "rejected"]);
    if (!gateStates.has(String(dealer.status))) {
      return fail("VALIDATION_ERROR", `This dealer is "${dealer.status}", not awaiting approval.`);
    }

    if (action === "approve") {
      dealer.status = "active";
      dealer.rejectionReason = null;
      await dealer.save();
      if (dealer.email) {
        await sendEmail({
          to: dealer.email,
          subject: `[${BRAND}] Your dealer account is approved`,
          text:
            `Good news — your ${BRAND} dealer account has been approved.\n\n` +
            `You can now add listings and start receiving buyer leads from your dashboard.`,
          html:
            `<p>Good news — your <strong>${BRAND}</strong> dealer account has been approved.</p>` +
            `<p>You can now add listings and start receiving buyer leads from your dashboard.</p>`,
        }).catch(() => {});
      }
      return ok({ id: String(dealer._id), status: dealer.status });
    }

    // reject
    dealer.status = "rejected";
    dealer.rejectionReason = reason || "Your application did not meet our verification requirements.";
    await dealer.save();
    if (dealer.email) {
      await sendEmail({
        to: dealer.email,
        subject: `[${BRAND}] Update on your dealer application`,
        text:
          `Thank you for your interest in ${BRAND}.\n\n` +
          `Unfortunately we could not approve your dealer account at this time.\n\n` +
          `Reason: ${dealer.rejectionReason}\n\n` +
          `If you believe this is a mistake, please contact our support team.`,
        html:
          `<p>Thank you for your interest in <strong>${BRAND}</strong>.</p>` +
          `<p>Unfortunately we could not approve your dealer account at this time.</p>` +
          `<p><strong>Reason:</strong> ${dealer.rejectionReason}</p>` +
          `<p>If you believe this is a mistake, please contact our support team.</p>`,
      }).catch(() => {});
    }
    return ok({ id: String(dealer._id), status: dealer.status });
  },
);
