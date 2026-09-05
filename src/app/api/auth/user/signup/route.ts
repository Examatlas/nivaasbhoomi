import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { hashPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";

/**
 * POST /api/auth/user/signup   (buyer — email + password, LAUNCH default)
 *   body: { name, email, phone, password }
 *
 * Creates the buyer with a bcrypt-hashed password. The phone is captured and
 * stored so the dealer has a number to call, but is NOT OTP-verified at launch
 * (phone verification returns once DLT/Meta approval lands — flip AUTH_METHOD).
 * On success, signs a 30-day { userId, role: 'user' } JWT into an httpOnly
 * cookie. Gated on AUTH_METHOD=password so it's inert under the OTP methods.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200),
  phone: z.string().trim().min(6).max(20),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

function validIndianMobile(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(phone);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (authMethod() !== "password") {
    return fail("FORBIDDEN", "Password signup is disabled.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!validIndianMobile(phone)) {
    return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");
  }

  await connectDB();

  const email = parsed.data.email;
  const existing = await User.findOne({ email }, { _id: 1 }).lean();
  if (existing) {
    return fail("DUPLICATE", "An account with this email already exists. Please sign in.");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({
    name: parsed.data.name,
    email,
    phone,
    passwordHash,
    lastLoginAt: new Date(),
  });

  const token = await signSession({ role: "user", userId: String(user._id) });
  (await cookies()).set(USER_COOKIE, token, sessionCookieOptions());

  return ok({ role: "user", userId: String(user._id), name: user.name ?? null });
});
