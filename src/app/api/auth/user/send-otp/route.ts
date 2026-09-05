import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { issueOtp } from "@/lib/auth/otp";
import { sendLoginOtp } from "@/lib/whatsapp/client";

/**
 * POST /api/auth/user/send-otp   (buyer login/signup — DEV-SPEC.txt Section 8)
 *   body: { phone }
 *
 * Buyer-facing sibling of the dealer OTP send. Same infrastructure (6-digit
 * code, 10-min TTL, 3 sends / phone / 10 min via issueOtp) delivered on the
 * SAME 'login_otp' WhatsApp template from NivaasBhoomi's own Meta app.
 *
 * Dev fallback: if the WhatsApp Cloud API isn't configured (or a send fails),
 * in development ONLY we return the code so login is testable without live
 * WhatsApp. In production an undelivered OTP is a hard error.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV !== "production";

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
});

function validIndianMobile(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(phone);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (authMethod() !== "whatsapp") {
    return fail("FORBIDDEN", "WhatsApp OTP login is disabled.");
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "A phone number is required.");
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!validIndianMobile(phone)) {
    return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");
  }

  const issued = await issueOtp(phone);
  if (!issued.ok || !issued.code) {
    return fail(
      "RATE_LIMITED",
      "Too many OTP requests. Please wait 10 minutes and try again.",
    );
  }

  const result = await sendLoginOtp(phone, issued.code);

  if (result.delivered) {
    return ok({ sent: true, channel: "whatsapp" });
  }

  if (isDev) {
    console.warn(
      `[DEV OTP] WhatsApp not delivered (${result.configured ? "send failed" : "not configured"}). ` +
        `Buyer OTP for +${phone} = ${issued.code}`,
    );
    return ok({
      sent: false,
      channel: "dev",
      devOtp: issued.code,
      devNote: "WhatsApp is not configured. This code is returned ONLY in development.",
    });
  }

  return fail("SERVER_ERROR", "Could not send the OTP right now. Please try again.");
});
