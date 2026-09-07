import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { authMethod } from "@/lib/config/flags";
import { consumeReset, type ResetRole } from "@/lib/auth/password-reset";
import { hashPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { setSessionHint } from "@/lib/auth/session-hint-server";
import {
  USER_COOKIE,
  DEALER_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/cookie";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";

/**
 * POST /api/auth/password/reset   { token, role, password }
 *
 * Verifies the single-use token, sets the new bcrypt hash on the matching
 * account, burns the token, and signs the user in. A bad/expired/used token
 * returns a single generic UNAUTHORIZED.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().trim().min(16).max(200),
  role: z.enum(["user", "dealer"]).default("user"),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (authMethod() !== "password") {
    return fail("FORBIDDEN", "Password reset is only available for email/password login.");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "A valid token and an 8+ character password are required.");
  }

  const role = parsed.data.role as ResetRole;
  const result = await consumeReset(role, parsed.data.token);
  if (!result.ok) {
    return fail("UNAUTHORIZED", "This reset link is invalid or has expired. Request a new one.");
  }

  await connectDB();
  const passwordHash = await hashPassword(parsed.data.password);

  if (role === "dealer") {
    const dealer = await Dealer.findOne({ email: result.email });
    if (!dealer) return fail("UNAUTHORIZED", "Account not found.");
    dealer.passwordHash = passwordHash;
    await dealer.save();
    const token = await signSession({ role: "dealer", dealerId: String(dealer._id) });
    (await cookies()).set(DEALER_COOKIE, token, sessionCookieOptions());
    return ok({ role: "dealer", redirect: "/dealer/dashboard" });
  }

  const user = await User.findOne({ email: result.email });
  if (!user) return fail("UNAUTHORIZED", "Account not found.");
  user.passwordHash = passwordHash;
  await user.save();
  const token = await signSession({ role: "user", userId: String(user._id) });
  (await cookies()).set(USER_COOKIE, token, sessionCookieOptions());
  await setSessionHint({ name: user.name, phone: user.phone, dealerId: user.dealerId });
  return ok({ role: "user", redirect: "/" });
});
