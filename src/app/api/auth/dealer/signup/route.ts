import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod, dealerLoginEnabled } from "@/lib/config/flags";
import { normalisePhone } from "@/lib/utils/whatsapp";
import { hashPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * POST /api/auth/dealer/signup   (dealer — email + password, LAUNCH default)
 *   body: { businessName, name?, email, phone, password }
 *
 * Creates the dealer (status 'active', verificationTier 0) with a bcrypt hash.
 * The dealer then completes coverage on onboarding (the dashboard redirects
 * there until profileComplete). Phone is the WhatsApp/contact number and stays
 * unique. Gated on dealer login being enabled AND AUTH_METHOD=password.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(160),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200),
  phone: z.string().trim().min(6).max(20),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

function validIndianMobile(phone: string): boolean {
  return /^91[6-9]\d{9}$/.test(phone);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!dealerLoginEnabled()) {
    return fail("FORBIDDEN", "Dealer sign-in is not available yet.");
  }
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
  // Either a taken email or a taken phone means this dealer already exists.
  const clash = await Dealer.findOne({ $or: [{ email }, { phone }] }, { _id: 1 }).lean();
  if (clash) {
    return fail(
      "DUPLICATE",
      "A dealer with this email or phone already exists. Please sign in.",
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const dealer = await Dealer.create({
    name: parsed.data.name?.trim() || parsed.data.businessName.trim(),
    businessName: parsed.data.businessName.trim(),
    email,
    phone,
    passwordHash,
    status: "active",
    verificationTier: 0,
  });

  const token = await signSession({ role: "dealer", dealerId: String(dealer._id) });
  (await cookies()).set(DEALER_COOKIE, token, sessionCookieOptions());

  return ok({ role: "dealer", dealerId: String(dealer._id) });
});
