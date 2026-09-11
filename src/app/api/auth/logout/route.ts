import { cookies } from "next/headers";

import { ok, withErrorHandling } from "@/lib/api/response";
import {
  ADMIN_COOKIE,
  STAFF_COOKIE,
  DEALER_COOKIE,
  USER_COOKIE,
  clearCookieOptions,
} from "@/lib/auth/cookie";
import { clearSessionHint } from "@/lib/auth/session-hint-server";

/**
 * POST /api/auth/logout  (DEV-SPEC.txt Section 7)
 * Clears every session cookie (admin, dealer, buyer). Safe to call whether or
 * not one is set.
 */
export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", clearCookieOptions());
  store.set(STAFF_COOKIE, "", clearCookieOptions());
  store.set(DEALER_COOKIE, "", clearCookieOptions());
  store.set(USER_COOKIE, "", clearCookieOptions());
  // Flip the (non-httpOnly) header hint to logged-out so the header shows
  // "Sign in" instantly, with no fetch and no reload.
  await clearSessionHint();
  return ok({ loggedOut: true });
});
