/**
 * City detection + selection helpers (pure, unit-tested).
 *
 * The home page is static/ISR, so it can't read per-request geo headers. A
 * tiny middleware writes the visitor's Vercel geo (city + lat/lng) into a
 * NON-httpOnly companion cookie `nb_geo`; the client reads it synchronously
 * (same pattern as the session hint). The chosen city is remembered in the
 * `nb_city` cookie (and, for logged-in buyers, on the User doc).
 *
 * These functions decide WHICH active city to show and why — kept pure so the
 * resolution rules are tested, not buried in a component.
 */

/** Companion cookie written by middleware from x-vercel-ip-* headers. */
export const GEO_COOKIE = "nb_geo";
/** The city the visitor has chosen (slug). Remembered across visits. */
export const CITY_COOKIE = "nb_city";

export interface GeoHint {
  city: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ActiveCity {
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
}

/** Where the shown city came from — drives the "nearest city" honesty label. */
export type CitySource = "selected" | "detected" | "nearest" | "default";

export interface CityResolution {
  city: ActiveCity;
  source: CitySource;
  /** The visitor's actual detected city name, when it isn't the one shown. */
  detectedName: string | null;
}

/** Parse the `nb_geo` cookie value → GeoHint, or null if absent/malformed. */
export function decodeGeo(raw: string | undefined | null): GeoHint | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Partial<GeoHint>;
    const city = typeof o.city === "string" && o.city.trim() ? o.city.trim() : null;
    const lat = typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null;
    const lng = typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null;
    if (!city && lat == null) return null;
    return { city, lat, lng };
  } catch {
    return null;
  }
}

/** Serialize a GeoHint for the `nb_geo` cookie (URL-encoded JSON). */
export function encodeGeo(g: GeoHint): string {
  return encodeURIComponent(JSON.stringify(g));
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Match a detected city NAME to an active city (loose: equality or prefix). */
export function matchCityByName(cities: ActiveCity[], name: string | null): ActiveCity | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  return (
    cities.find((c) => norm(c.name) === n) ??
    cities.find((c) => norm(c.name).startsWith(n) || n.startsWith(norm(c.name))) ??
    null
  );
}

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest active city (with coords) to a point, or null if none has coords. */
export function nearestActiveCity(
  cities: ActiveCity[],
  lat: number,
  lng: number,
): ActiveCity | null {
  let best: ActiveCity | null = null;
  let bestKm = Infinity;
  for (const c of cities) {
    if (c.lat == null || c.lng == null) continue;
    const km = haversineKm({ lat, lng }, { lat: c.lat, lng: c.lng });
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return best;
}

/**
 * Decide which active city to show:
 *   1. an explicit selection (cookie / User doc) that is still active
 *   2. a detected city that is itself active
 *   3. the active city nearest to the detected coordinates
 *   4. the default (first active city)
 * Returns null only when there are no active cities.
 */
export function resolveCity(params: {
  cities: ActiveCity[];
  selectedSlug?: string | null;
  geo?: GeoHint | null;
}): CityResolution | null {
  const { cities, selectedSlug, geo } = params;
  if (cities.length === 0) return null;

  if (selectedSlug) {
    const picked = cities.find((c) => c.slug === selectedSlug);
    if (picked) return { city: picked, source: "selected", detectedName: null };
  }

  if (geo) {
    const byName = matchCityByName(cities, geo.city);
    if (byName) return { city: byName, source: "detected", detectedName: geo.city };

    if (geo.lat != null && geo.lng != null) {
      const near = nearestActiveCity(cities, geo.lat, geo.lng);
      if (near) return { city: near, source: "nearest", detectedName: geo.city };
    }
  }

  return { city: cities[0]!, source: "default", detectedName: geo?.city ?? null };
}
