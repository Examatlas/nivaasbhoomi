import "server-only";
import { cookies } from "next/headers";

import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/jwt";
import {
  SESSION_HINT_COOKIE,
  encodeSessionHint,
  type SessionHint,
} from "@/lib/auth/session-ui";

/**
 * Writes the companion "session hint" cookie (see session-ui) next to the
 * httpOnly JWT. Deliberately NOT httpOnly — the client reads it to paint the
 * header without a fetch. It is display-only; the JWT stays authoritative for
 * auth. Set it wherever the buyer USER_COOKIE is set, and clear it on logout.
 */
function hintCookieOptions() {
  return {
    httpOnly: false, // the client must be able to read this one
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function setSessionHint(user: {
  name?: string | null;
  phone?: string | null;
  dealerId?: unknown | null;
}): Promise<void> {
  const hint: SessionHint = {
    a: 1,
    n: user.name ?? null,
    p: user.phone ?? null,
    d: user.dealerId ? String(user.dealerId) : null,
  };
  (await cookies()).set(SESSION_HINT_COOKIE, encodeSessionHint(hint), hintCookieOptions());
}

/** Mark the hint as explicitly logged-out (a:0) so the client shows "Sign in"
 *  instantly, with no fetch. Used on logout and when /api/auth/me finds no session. */
export async function clearSessionHint(): Promise<void> {
  (await cookies()).set(SESSION_HINT_COOKIE, encodeSessionHint({ a: 0 }), hintCookieOptions());
}
