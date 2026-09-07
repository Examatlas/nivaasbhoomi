import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Otp } from "@/lib/db/models/Otp";
import { Dealer } from "@/lib/db/models/Dealer";
import { User } from "@/lib/db/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { setSessionHint } from "@/lib/auth/session-hint-server";
import {
  normalizeIndianMobile,
  isExpired,
  isLockedOut,
  decideVerify,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth/otp-login";

/**
 * POST /api/auth/otp/verify   { phone, code, role }   role = "buyer" | "dealer"
 *
 * Verifies the login OTP and signs the matching session (existing JWT cookie
 * pattern). Max 5 attempts, then the code is burned. On success:
 *   dealer -> existing dealer signs in; a number with no dealer gets a verified
 *             User + buyer session and is sent to /dealer/register (self-signup).
 *   buyer  -> found, else auto-created with phoneVerified = true.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().trim().min(1).max(20),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
  role: z.enum(["buyer", "dealer"]),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Phone, a 6-digit code and a role are required.");

  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) return fail("VALIDATION_ERROR", "Enter a valid 10-digit Indian mobile number.");
  const { code, role } = parsed.data;

  await connectDB();
  const otp = await Otp.findOne({ phone });
  if (!otp) {
    return fail("UNAUTHORIZED", "That code is incorrect or has expired. Request a new one.");
  }
  if (isExpired(otp.createdAt as Date, new Date())) {
    await Otp.deleteMany({ phone });
    return fail("UNAUTHORIZED", "That code has expired. Request a new one.");
  }

  const match = await verifyPassword(code, otp.codeHash);
  if (!match) {
    otp.attempts = (otp.attempts ?? 0) + 1;
    if (isLockedOut(otp.attempts)) {
      await Otp.deleteMany({ phone });
      return fail("RATE_LIMITED", "Too many incorrect attempts. Request a new code.");
    }
    await otp.save();
    const left = OTP_MAX_ATTEMPTS - otp.attempts;
    return fail("UNAUTHORIZED", `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`);
  }

  // Correct — burn the code.
  await Otp.deleteMany({ phone });

  if (role === "dealer") {
    const dealer = await Dealer.findOne({ phone });

    // No dealer on this number → self-registration (no dead end). Find or create
    // the underlying User (phoneVerified), set the BUYER session so the dealer
    // registration form can submit to /api/users/me/upgrade (requireUser), then
    // point the client at /dealer/register. The upgrade route creates the Dealer
    // as "pending", links both sides, and emails an admin.
    if (decideVerify("dealer", Boolean(dealer)) === "register-dealer" || !dealer) {
      let user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({ phone, phoneVerified: true, lastLoginAt: new Date() });
      } else {
        user.phoneVerified = true;
        user.lastLoginAt = new Date();
        await user.save();
      }
      // Already linked to a dealer (edge: linked User, dealer lookup raced) →
      // straight to the dashboard with both sessions.
      const store = await cookies();
      const linkedDealerId = user.dealerId ? String(user.dealerId) : undefined;
      const userToken = await signSession({
        role: "user",
        userId: String(user._id),
        ...(linkedDealerId ? { dealerId: linkedDealerId } : {}),
      });
      store.set(USER_COOKIE, userToken, sessionCookieOptions());
      await setSessionHint({ name: user.name, phone: user.phone, dealerId: user.dealerId });
      if (linkedDealerId) {
        const dealerToken = await signSession({ role: "dealer", dealerId: linkedDealerId });
        store.set(DEALER_COOKIE, dealerToken, sessionCookieOptions());
        return ok({ role: "dealer", dealerId: linkedDealerId, redirect: "/dealer/dashboard" });
      }
      return ok({
        role: "user",
        userId: String(user._id),
        needsRegistration: true,
        name: user.name ?? null,
        redirect: "/dealer/register",
      });
    }

    if (dealer.status === "banned") {
      return fail("FORBIDDEN", "This account has been suspended.");
    }
    dealer.phoneVerified = true;
    await dealer.save();
    const token = await signSession({ role: "dealer", dealerId: String(dealer._id) });
    (await cookies()).set(DEALER_COOKIE, token, sessionCookieOptions());
    return ok({ role: "dealer", dealerId: String(dealer._id), redirect: "/dealer/dashboard" });
  }

  // Buyer: find or auto-create.
  let user = await User.findOne({ phone });
  const isNew = !user;
  if (!user) {
    user = await User.create({ phone, phoneVerified: true, lastLoginAt: new Date() });
  } else {
    user.phoneVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
  }

  const linkedDealerId = user.dealerId ? String(user.dealerId) : undefined;
  const store = await cookies();
  const token = await signSession({
    role: "user",
    userId: String(user._id),
    ...(linkedDealerId ? { dealerId: linkedDealerId } : {}),
  });
  store.set(USER_COOKIE, token, sessionCookieOptions());
  await setSessionHint({ name: user.name, phone: user.phone, dealerId: user.dealerId });
  // A linked buyer→dealer gets the dealer session too, so one login serves both
  // panels (no second sign-in). Dealer Dashboard then shows in the header.
  if (linkedDealerId) {
    const dealerToken = await signSession({ role: "dealer", dealerId: linkedDealerId });
    store.set(DEALER_COOKIE, dealerToken, sessionCookieOptions());
  }
  return ok({
    role: "user",
    userId: String(user._id),
    dealerId: linkedDealerId ?? null,
    isNew,
    redirect: "/",
  });
});
