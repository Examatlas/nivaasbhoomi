import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { signSession } from "@/lib/auth/jwt";
import { DEALER_COOKIE, USER_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { setSessionHint } from "@/lib/auth/session-hint-server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import {
  dealerRegistrationSchema,
  registerDealerForUser,
  type DealerRegistrationInput,
} from "@/lib/dealers/register";

/**
 * POST /api/users/me/upgrade   [buyer auth]
 *
 * A logged-in buyer becomes a dealer (the /profile → "Become a dealer" path).
 * Delegates the Dealer create/link + validation + anti-spam to the shared
 * registerDealerForUser() so this and the token-based self-signup stay identical.
 * On success the dealer session cookie is set (one login, both panels).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_INPUT: DealerRegistrationInput = {
  businessName: "",
  dealTypes: [],
  coverageCities: [],
  coverageLocalities: [],
};

async function setDealerCookie(
  user: { _id: unknown; name?: string | null; phone?: string | null },
  dealerId: string,
): Promise<void> {
  const store = await cookies();
  const userToken = await signSession({ role: "user", userId: String(user._id), dealerId });
  store.set(USER_COOKIE, userToken, sessionCookieOptions());
  const dealerToken = await signSession({ role: "dealer", dealerId });
  store.set(DEALER_COOKIE, dealerToken, sessionCookieOptions());
  await setSessionHint({ name: user.name, phone: user.phone, dealerId });
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  await connectDB();
  const user = await User.findById(auth.identity.userId);
  if (!user) return fail("NOT_FOUND", "Account not found.");

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* an existing manual dealer links without a form body */
  }

  // The helper links to an existing/manual dealer BEFORE it reads the form
  // fields, so a link works even without a valid form; a genuine CREATE needs one.
  const parsed = dealerRegistrationSchema.safeParse(json);
  const input = parsed.success ? parsed.data : EMPTY_INPUT;

  // Honour an edited name (the form prefills the buyer's name but keeps it editable).
  const formName = parsed.success ? parsed.data.name?.trim() : undefined;
  if (formName && formName !== user.name) {
    user.name = formName;
    await user.save();
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const result = await registerDealerForUser(user, input, ip);
  if (!result.ok) {
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
    }
    return fail(result.code, result.message, result.details);
  }

  await setDealerCookie(user, result.dealerId);
  return ok({
    dealerId: result.dealerId,
    ...(result.alreadyDealer
      ? { alreadyDealer: true }
      : result.linked
        ? { linked: true }
        : { created: true }),
    status: result.status,
  });
});
