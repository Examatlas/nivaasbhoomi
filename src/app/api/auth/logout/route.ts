import { cookies } from "next/headers";

import { ok, withErrorHandling } from "@/lib/api/response";
import { ADMIN_COOKIE, DEALER_COOKIE, clearCookieOptions } from "@/lib/auth/cookie";

/**
 * POST /api/auth/logout  (DEV-SPEC.txt Section 7)
 * Clears both session cookies. Safe to call whether or not one is set.
 */
export const POST = withErrorHandling(async () => {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", clearCookieOptions());
  store.set(DEALER_COOKIE, "", clearCookieOptions());
  return ok({ loggedOut: true });
});
