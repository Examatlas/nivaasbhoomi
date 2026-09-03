import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { verifyOtp } from "@/lib/auth/otp";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * POST /api/auth/dealer/verify-otp   (DEV-SPEC.txt Section 8)
 *   body: { phone, otp }
 *
 * Verifies the OTP, creates the dealer on first login (status 'active',
 * verificationTier 0), signs a 30-day JWT { dealerId, role: 'dealer' } and sets
 * it as an httpOnly, secure, sameSite=lax cookie.
 *
 * The dealerId in the session comes ONLY from the phone we just proved ownership
 * of - never from anything the client sends.
 */
const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits."),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Phone and a 6-digit OTP are required.");
  }

  const phone = normalisePhone(parsed.data.phone);

  const result = await verifyOtp(phone, parsed.data.otp);
  if (!result.ok) {
    if (result.reason === "too_many_attempts") {
      return fail("RATE_LIMITED", "Too many attempts. Request a new OTP.");
    }
    if (result.reason === "expired") {
      return fail("UNAUTHORIZED", "This OTP has expired. Request a new one.");
    }
    return fail("UNAUTHORIZED", "Incorrect OTP. Please try again.");
  }

  await connectDB();

  // First login creates the dealer. name/businessName are required by the model
  // but not known yet at OTP signup, so we set a phone-derived placeholder the
  // dealer completes during onboarding (a later phase). Tier is 0, status active.
  const last4 = phone.slice(-4);
  const dealer =
    (await Dealer.findOne({ phone })) ??
    (await Dealer.create({
      phone,
      name: `Dealer ${last4}`,
      businessName: `Dealer ${last4}`,
      status: "active",
      verificationTier: 0,
    }));

  if (dealer.status === "banned") {
    return fail("FORBIDDEN", "This account has been suspended.");
  }

  const token = await signSession({ role: "dealer", dealerId: String(dealer._id) });
  (await cookies()).set(DEALER_COOKIE, token, sessionCookieOptions());

  return ok({
    role: "dealer",
    dealerId: String(dealer._id),
    isNew: !dealer.businessName || dealer.businessName === `Dealer ${last4}`,
  });
});
