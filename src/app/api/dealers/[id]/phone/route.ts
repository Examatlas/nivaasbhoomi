import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireDealer } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { phoneInUse } from "@/lib/auth/account-guards";

/**
 * POST /api/dealers/[id]/phone   [dealer auth, self]
 *
 * Change the dealer's phone (their WhatsApp / OTP identifier). The number is
 * updated in place on the SAME record, so the account is never orphaned — the
 * session is keyed by dealerId, and if WhatsApp-OTP login is re-enabled the
 * lookup by the new phone still resolves this dealer. Duplicates across dealers
 * are rejected. The number is flagged UNVERIFIED because WhatsApp OTP is
 * currently blocked (WABA unverified).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ phone: z.string().trim().min(6).max(20) });

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/dealers/[id]/phone">) => {
    const auth = await requireDealer();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (id !== auth.identity.dealerId) {
      return fail("FORBIDDEN", "You can only change your own phone number.");
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "Enter a valid phone number.");

    const phone = normalisePhone(parsed.data.phone);
    if (!/^\d{10,15}$/.test(phone)) {
      return fail("VALIDATION_ERROR", "Enter a valid phone number with country code.");
    }

    await connectDB();
    const dealer = await Dealer.findById(id);
    if (!dealer) return fail("NOT_FOUND", "Dealer not found.");

    if (dealer.phone === phone) return ok({ phone, changed: false });

    if (await phoneInUse(phone, id)) {
      return fail("DUPLICATE", "That number is already used by another dealer.");
    }

    // TODO(otp): once WhatsApp Business (WABA) is verified, gate this behind an
    // OTP sent to the NEW number — only set `phone` + `phoneVerified = true`
    // after verifyOtp() succeeds. For now the change is allowed but unverified.
    dealer.phone = phone;
    dealer.phoneVerified = false;
    await dealer.save();

    return ok({ phone, changed: true, phoneVerified: false });
  },
);
