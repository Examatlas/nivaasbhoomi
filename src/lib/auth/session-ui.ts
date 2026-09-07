/**
 * Pure helpers for the buyer session UI (header + profile prompt), so the
 * show/hide rules are unit-tested rather than hidden in components.
 */
export interface Me {
  authed: boolean;
  role?: "buyer";
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Set when this buyer is also a linked dealer (post-upgrade). */
  dealerId?: string | null;
  profileComplete?: boolean;
}

/**
 * Companion "session hint" cookie — a small, NON-httpOnly cookie set alongside
 * the httpOnly JWT so the client can render the correct header on the FIRST
 * paint with no /api/auth/me fetch (that fetch is what caused the "Sign in →
 * name" flicker). It carries only the buyer's OWN display data; the httpOnly JWT
 * remains the security source of truth, so tampering only changes what the user
 * sees in their own header, never what the server authorizes.
 */
export const SESSION_HINT_COOKIE = "nb_session_hint";

export interface SessionHint {
  /** authed: 1 = logged-in buyer, 0 = explicitly logged out. */
  a: 0 | 1;
  n?: string | null; // name
  p?: string | null; // phone
  d?: string | null; // dealerId
}

/** Serialize a hint for the companion cookie (URL-encoded JSON). */
export function encodeSessionHint(h: SessionHint): string {
  return encodeURIComponent(JSON.stringify(h));
}

/**
 * Parse the companion cookie value → Me. Returns null when the cookie is absent
 * or malformed ("unknown" — the caller then falls back to /api/auth/me once).
 * A present-but-logged-out hint (a:0) resolves to a definite { authed: false }.
 */
export function decodeSessionHint(raw: string | undefined | null): Me | null {
  if (!raw) return null;
  try {
    const h = JSON.parse(decodeURIComponent(raw)) as SessionHint;
    if (!h || (h.a !== 0 && h.a !== 1)) return null;
    if (h.a === 0) return { authed: false };
    return {
      authed: true,
      role: "buyer",
      name: h.n ?? null,
      phone: h.p ?? null,
      dealerId: h.d ?? null,
      profileComplete: Boolean(h.n),
    };
  } catch {
    return null;
  }
}

/** Read one cookie value out of a `document.cookie` string (pure, testable). */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of (cookieString ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** The profile-completion popup shows only for a logged-in buyer who has no
 *  name yet AND has not dismissed it this session. */
export function shouldPromptProfileCompletion(me: Me | null, dismissed: boolean): boolean {
  if (!me || !me.authed) return false;
  if (dismissed) return false;
  return !me.name;
}

/** Avatar letter: first letter of the name, else of the phone, else "U". */
export function avatarInitial(name?: string | null, phone?: string | null): string {
  const n = (name ?? "").trim();
  if (n) return n[0]!.toUpperCase();
  const p = (phone ?? "").replace(/\D/g, "");
  if (p) return p[p.length - 1]!;
  return "U";
}

/** Display "+91 XXXXXXXXXX" from a canonical "91XXXXXXXXXX". */
export function formatSessionPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2)}`;
  return `+${digits}`;
}
