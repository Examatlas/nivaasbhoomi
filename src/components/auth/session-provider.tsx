"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { Me } from "@/lib/auth/session-ui";
import { SESSION_HINT_COOKIE, decodeSessionHint, readCookie } from "@/lib/auth/session-ui";

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({ me: null, loading: true, refresh: async () => {} });

/**
 * Client-side buyer session. The public pages are ISR/static, so the server
 * can't bake per-user state into them. Instead a small NON-httpOnly companion
 * cookie (nb_session_hint) is set alongside the httpOnly JWT at every session
 * change; the client reads it SYNCHRONOUSLY, so the header paints the correct
 * state immediately with no /api/auth/me fetch — that fetch is what caused the
 * "Sign in → name" flicker. We fall back to /api/auth/me only when the hint is
 * absent (a legacy session from before this cookie existed, or a brand-new
 * visitor); that route re-sets the hint, so it self-heals to zero fetches.
 *
 * The initial state is `null` (loading) so it matches the static SSR shell —
 * the header renders a neutral placeholder, never a wrong "Sign in", until the
 * hint resolves on mount. Re-reading on every navigation keeps the header in
 * sync right after a login/logout/profile redirect.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const readHint = useCallback((): Me | null => {
    if (typeof document === "undefined") return null;
    return decodeSessionHint(readCookie(document.cookie, SESSION_HINT_COOKIE));
  }, []);

  const refresh = useCallback(async () => {
    // A change we made (login/logout/profile) already re-wrote the hint, so the
    // synchronous read is authoritative and needs no network.
    const hint = readHint();
    if (hint) {
      setMe(hint);
      setLoading(false);
      return;
    }
    // No hint → resolve from the server once (heals legacy/first-time sessions).
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: Me };
      setMe(json?.success && json.data ? json.data : { authed: false });
    } catch {
      setMe({ authed: false });
    } finally {
      setLoading(false);
    }
  }, [readHint]);

  // On mount + every navigation: hydrate from the hint (instant), else fall back.
  useEffect(() => {
    const hint = readHint();
    if (hint) {
      setMe(hint);
      setLoading(false);
    } else {
      void refresh();
    }
  }, [pathname, readHint, refresh]);

  return <Ctx.Provider value={{ me, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  return useContext(Ctx);
}
