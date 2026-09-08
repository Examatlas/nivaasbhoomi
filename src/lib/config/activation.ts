/**
 * City activation + SEO-index thresholds (single source of truth).
 *
 * Env-overridable so they can be tuned without a deploy; standalone (no DB / no
 * Node-only imports) so it's safe to import from anywhere, including the guard
 * service, the public city page and the sitemap.
 */
function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

/**
 * A city may be set active once it meets these live counts. Default: just 1
 * listing (no dealer / locality requirement) — the point is to SHOW the city.
 * Seed (display-only) listings DO count toward activation (see activation.ts).
 */
export const CITY_ACTIVATION = {
  minListings: envInt("CITY_ACTIVATION_MIN_LISTINGS", 1),
  minDealers: envInt("CITY_ACTIVATION_MIN_DEALERS", 0),
  minLocalities: envInt("CITY_ACTIVATION_MIN_LOCALITIES", 0),
} as const;

/**
 * SEO thin-content guard: a city page stays noindex AND is kept out of the
 * sitemap until it has at least this many approved listings. Activating a city
 * (so it renders + appears in "Popular cities") is deliberately decoupled from
 * indexing it — a 1-listing city goes live but is not fed to Google until it has
 * real depth. Default 5.
 */
export const CITY_INDEX_MIN_LISTINGS: number = envInt("CITY_INDEX_MIN_LISTINGS", 5);
