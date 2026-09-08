"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/components/auth/session-provider";
import { apiFetch } from "@/lib/api/client";

/**
 * Buyer shortlist state, shared across every heart on a page.
 *
 * The public pages are ISR/static, so per-user saved state can't be baked in.
 * Instead this provider makes ONE call to GET /api/saved on login and keeps the
 * saved ids in a Set; each <SaveButton> reads/toggles through here, so a page of
 * cards costs a single request, not one per card. A logged-out toggle bounces to
 * /login with a returnUrl (the account-based save requires auth).
 */
interface SavedCtx {
  ready: boolean;
  isSaved: (listingId: string) => boolean;
  toggle: (listingId: string) => void;
}

const Ctx = createContext<SavedCtx>({
  ready: false,
  isSaved: () => false,
  toggle: () => {},
});

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const authed = Boolean(me?.authed);

  useEffect(() => {
    let cancelled = false;
    // Nested async fn so no setState runs synchronously in the effect body.
    async function sync() {
      if (!authed) {
        // Clear any prior user's saves (e.g. after logout).
        if (!cancelled) {
          setIds(new Set());
          setReady(true);
        }
        return;
      }
      try {
        const d = await apiFetch<{ ids: string[] }>("/api/saved");
        if (!cancelled) setIds(new Set(d.ids));
      } catch {
        if (!cancelled) setIds(new Set());
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const isSaved = useCallback((listingId: string) => ids.has(listingId), [ids]);

  const toggle = useCallback(
    (listingId: string) => {
      if (!authed) {
        const next =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const wasSaved = ids.has(listingId);
      // Optimistic update — revert on failure.
      setIds((prev) => {
        const copy = new Set(prev);
        if (wasSaved) copy.delete(listingId);
        else copy.add(listingId);
        return copy;
      });
      apiFetch("/api/saved", {
        method: wasSaved ? "DELETE" : "POST",
        body: JSON.stringify({ listingId }),
      }).catch(() => {
        setIds((prev) => {
          const copy = new Set(prev);
          if (wasSaved) copy.add(listingId);
          else copy.delete(listingId);
          return copy;
        });
      });
    },
    [authed, ids, router],
  );

  return <Ctx.Provider value={{ ready, isSaved, toggle }}>{children}</Ctx.Provider>;
}

export function useSaved(): SavedCtx {
  return useContext(Ctx);
}
