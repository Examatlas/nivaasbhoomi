"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useSession } from "@/components/auth/session-provider";
import { readCookie } from "@/lib/auth/session-ui";
import { trackEvent } from "@/lib/analytics/track";
import {
  CITY_COOKIE,
  GEO_COOKIE,
  decodeGeo,
  resolveCity,
  type ActiveCity,
  type CityResolution,
} from "@/lib/locations/geo";

interface CityCtx {
  cities: ActiveCity[];
  /** null until resolved on mount, or when there are no active cities. */
  resolution: CityResolution | null;
  ready: boolean;
  setCity: (slug: string) => void;
}

const Ctx = createContext<CityCtx>({
  cities: [],
  resolution: null,
  ready: false,
  setCity: () => {},
});

function writeCityCookie(slug: string) {
  try {
    document.cookie = `${CITY_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* private mode — the in-memory selection still works for this visit */
  }
}

/**
 * Client city context. The static/ISR pages ship a neutral shell; on mount this
 * resolves the visitor's city SYNCHRONOUSLY from cookies (chosen `nb_city` →
 * geo `nb_geo` → nearest → default) so there's no fetch and no flash. A chosen
 * city is remembered in the cookie and, for logged-in buyers, on the account.
 */
export function CityProvider({
  cities,
  children,
}: {
  cities: ActiveCity[];
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const [resolution, setResolution] = useState<CityResolution | null>(null);
  const [ready, setReady] = useState(false);

  // Resolve from cookies on mount (client-only, matches the SSR neutral shell).
  useEffect(() => {
    const rawSelected = readCookie(document.cookie, CITY_COOKIE);
    const selectedSlug = rawSelected ? decodeURIComponent(rawSelected) : null;
    const geo = decodeGeo(readCookie(document.cookie, GEO_COOKIE));
    setResolution(resolveCity({ cities, selectedSlug, geo }));
    setReady(true);
  }, [cities]);

  // Logged-in buyer with no local choice yet → adopt the city saved on the
  // account (so the selection follows them across devices).
  useEffect(() => {
    if (!ready || !me?.authed) return;
    if (readCookie(document.cookie, CITY_COOKIE)) return; // local choice wins
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const json = (await res.json()) as { data?: { preferredCitySlug?: string | null } };
        const slug = json?.data?.preferredCitySlug ?? null;
        const match = slug ? cities.find((c) => c.slug === slug) : null;
        if (!cancelled && match) {
          setResolution({ city: match, source: "selected", detectedName: null });
        }
      } catch {
        /* ignore — the cookie/geo resolution already stands */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, me?.authed, cities]);

  const setCity = useCallback(
    (slug: string) => {
      const city = cities.find((c) => c.slug === slug);
      if (!city) return;
      trackEvent("city_switch", { from: resolution?.city.slug ?? null, to: slug });
      writeCityCookie(slug);
      setResolution({ city, source: "selected", detectedName: null });
      if (me?.authed) {
        // Best-effort: persist to the account so it follows the buyer.
        void fetch("/api/users/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ preferredCitySlug: slug }),
        }).catch(() => {});
      }
    },
    [cities, me?.authed, resolution?.city.slug],
  );

  return <Ctx.Provider value={{ cities, resolution, ready, setCity }}>{children}</Ctx.Provider>;
}

export function useCity(): CityCtx {
  return useContext(Ctx);
}
