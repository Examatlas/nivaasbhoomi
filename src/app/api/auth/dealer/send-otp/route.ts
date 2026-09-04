import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { dealerLoginEnabled } from "@/lib/config/flags";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { issueOtp } from "@/lib/auth/otp";
import { sendLoginOtp } from "@/lib/whatsapp/client";

/**
 * POST /api/auth/dealer/send-otp   (DEV-SPEC.txt Section 8)
 *   body: { phone }
 *
 * Generates a 6-digit OTP, stores an HMAC of it with a 10-minute TTL, and sends
 * it via the WhatsApp `login_otp` template. Rate limit: 3 sends per phone per
 * 10 minutes (enforced in issueOtp).
 *
 * Dev fallback: if the WhatsApp Cloud API is not configured (or the send fails),
 * in development ONLY we return + log the code so login is testable without live
 * WhatsApp. In production an undelivered OTP is a hard error - the code is never
 * exposed.
 */
const isDev = process.env.NODE_ENV !== "production";

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
});

function validIndianMobile(phone: string): boolean {
  // Normalised to country-code form: 91 + 10 digits, first mobile digit 6-9.
  return /^91[6-9]\d{9}$/.test(phone);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!dealerLoginEnabled()) {
    return fail("FORBIDDEN", "Dealer sign-in is not available yet.");
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

  // Not delivered (unconfigured or failed).
  if (isDev) {
    console.warn(
      `[DEV OTP] WhatsApp not delivered (${result.configured ? "send failed" : "not configured"}). ` +
        `OTP for +${phone} = ${issued.code}`,
    );
    return ok({
      sent: false,
      channel: "dev",
      devOtp: issued.code,
      devNote:
        "WhatsApp is not configured. This code is returned ONLY in development.",
    });
  }

  return fail("SERVER_ERROR", "Could not send the OTP right now. Please try again.");
});
