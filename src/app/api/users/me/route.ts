import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { Dealer } from "@/lib/db/models/Dealer";
import { setSessionHint } from "@/lib/auth/session-hint-server";

/**
 * PATCH /api/users/me   [buyer auth, self]   { name?, email? }
 *
 * Buyer self-service profile update — name (the display name) and an OPTIONAL
 * email. Email must be unique across Users and Dealers (a collision would break
 * the password-reset lookup). Phone is the login identity and is never changed
 * here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(200)
    .optional()
    .or(z.literal("")),
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const userId = auth.identity.userId;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
  const { name } = parsed.data;
  const email = parsed.data.email ? parsed.data.email : undefined;

  await connectDB();
  const user = await User.findById(userId);
  if (!user) return fail("NOT_FOUND", "Account not found.");

  if (email && email !== user.email) {
    const [clashUser, clashDealer] = await Promise.all([
      User.exists({ email, _id: { $ne: new mongoose.Types.ObjectId(userId) } }),
      Dealer.exists({ email }),
    ]);
    if (clashUser || clashDealer) {
      return fail("DUPLICATE", "That email is already in use by another account.");
    }
  }

  if (name !== undefined) user.name = name;
  if (parsed.data.email !== undefined) user.email = email; // "" clears it

  await user.save();

  // Refresh the header hint so the (possibly new) name shows on the next paint
  // with no fetch — the client's refresh() after a profile save reads it.
  await setSessionHint({ name: user.name, phone: user.phone, dealerId: user.dealerId });

  return ok({
    id: String(user._id),
    name: user.name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    profileComplete: Boolean(user.name),
  });
});
