"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type { Me } from "@/lib/auth/session-ui";

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({ me: null, loading: true, refresh: async () => {} });

/**
 * Client-side buyer session. The public pages are ISR/static, so login state is
 * fetched from /api/auth/me on the client and shared through this context so the
 * header and the profile prompt stay in sync (and update instantly after login
 * or a profile save via refresh()).
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: Me };
      setMe(json?.success && json.data ? json.data : { authed: false });
    } catch {
      setMe({ authed: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ me, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  return useContext(Ctx);
}
