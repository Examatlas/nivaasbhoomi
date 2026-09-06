import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { emailInUse } from "@/lib/auth/account-guards";
import { consumeEmailChange } from "@/lib/auth/email-change";

/**
 * POST /api/dealers/email/verify   { token }
 *
 * Completes a dealer email change. No session is required — the single-use token
 * (sent to the new address) is the authorization, so the dealer can confirm from
 * any device. Verifies + burns the token, re-checks that the email is still free
 * (a race could have claimed it since the request), then swaps pendingEmail into
 * email. A used/expired token returns one generic UNAUTHORIZED.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().trim().min(16).max(200) });

export const POST = withErrorHandling(async (req: NextRequest) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A valid token is required.");

  const result = await consumeEmailChange(parsed.data.token);
  if (!result.ok) {
    return fail("UNAUTHORIZED", "This link is invalid or has expired. Request a new one.");
  }

  await connectDB();
  const dealer = await Dealer.findById(result.dealerId);
  if (!dealer) return fail("NOT_FOUND", "Account not found.");

  // Re-check at swap time: someone else may have claimed this email in the
  // meantime. Don't strand the account on a colliding value.
  if (await emailInUse(result.newEmail, result.dealerId)) {
    if (dealer.pendingEmail === result.newEmail) {
      dealer.pendingEmail = null;
      await dealer.save();
    }
    return fail("DUPLICATE", "That email is now in use by another account. Please try a different one.");
  }

  dealer.email = result.newEmail;
  dealer.pendingEmail = null;
  await dealer.save();

  return ok({ verified: true, email: result.newEmail });
});
