/**
 * Shared SEO site constants and helpers (DEV-SPEC.txt Section 10).
 * SITE_URL is the canonical origin; every canonical/OG URL is built from it so
 * the site is always self-referencing on one host.
 */

export const BRAND = "NivaasBhoomi";

const DEFAULT_SITE_URL = "https://nivaasbhoomi.com";

/**
 * Resolve the canonical origin defensively. `?? default` is NOT enough: on
 * Vercel the env var can be present but EMPTY ("") — which is not nullish, so it
 * slips past `??` and `new URL("")` throws "Invalid URL", failing the build at
 * metadataBase. So: trim, treat empty as missing, add https:// if the scheme is
 * omitted, and fall back if it still doesn't parse. Always returns a valid
 * absolute origin with no trailing slash.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Canonical origin, no trailing slash. Always a valid absolute URL. */
export const SITE_URL = resolveSiteUrl();

/** Portal WhatsApp number, used in JSON-LD contactPoint / sameAs. */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/** Build an absolute URL from a path (leading slash optional). */
export function absoluteUrl(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean === "/" ? "" : clean}` || SITE_URL;
}

/**
 * Meta descriptions target 150-160 chars (Section 10). Trim to a word boundary
 * at ~157 and add an ellipsis so we never cut mid-word or blow past the limit.
 */
export function truncateDescription(text: string, max = 157): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

/** Indian price -> short label for titles (e.g. 5200000 -> "52 Lakh"). */
export function priceLabelForTitle(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Price on request";
  const CRORE = 10_000_000;
  const LAKH = 100_000;
  if (value >= CRORE) {
    return `${Number((value / CRORE).toFixed(2))} Crore`;
  }
  if (value >= LAKH) {
    return `${Number((value / LAKH).toFixed(2))} Lakh`;
  }
  return value.toLocaleString("en-IN");
}
