import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { verifyOtp } from "@/lib/auth/otp";
import { signSession } from "@/lib/auth/jwt";
import { USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

/**
 * POST /api/auth/user/verify-otp   (buyer login/signup — DEV-SPEC.txt Section 8)
 *   body: { phone, otp, name? }
 *
 * Verifies the OTP, creates the buyer on first login, signs a 30-day
 * { userId, role: 'user' } JWT and sets it as an httpOnly cookie. The optional
 * name is captured on first signup (and filled in later if it was blank) so the
 * dealer sees a name on the lead. The userId/phone come ONLY from the number we
 * just proved ownership of — never from anything else the client sends.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits."),
  name: z.string().trim().max(120).optional(),
});

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

  const name = parsed.data.name?.trim();
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone, name, lastLoginAt: new Date() });
  } else {
    // Fill in a name if we didn't have one; refresh last login.
    if (name && !user.name) user.name = name;
    user.lastLoginAt = new Date();
    await user.save();
  }

  const token = await signSession({ role: "user", userId: String(user._id) });
  (await cookies()).set(USER_COOKIE, token, sessionCookieOptions());

  return ok({
    role: "user",
    userId: String(user._id),
    name: user.name ?? null,
    isNew: !user.name,
  });
});
