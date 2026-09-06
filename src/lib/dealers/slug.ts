import { slugify } from "@/lib/utils/slug";

/**
 * Public dealer-profile slug rules. The slug lives at /agent/[slug].
 *
 * Generation reuses the general `slugify()` (lowercase, ASCII, a-z0-9-hyphen,
 * collapse repeats, trim) and the SAME numeric-suffix collision tail the
 * location system uses (`while (isTaken(base-n)) n++`) — no new algorithm.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

/**
 * Reserved words a dealer slug may never be — the private /dealer/* sub-route
 * names plus the public route siblings — so a slug can never shadow a real route
 * or read as a system page.
 */
export const RESERVED_DEALER_SLUGS = new Set<string>([
  "admin", "api", "login", "signup", "dashboard", "automation", "oauth",
  "profile", "settings", "listings", "leads", "verification",
  "agent", "dealer", "onboarding", "plan",
]);

export type SlugValidation = { ok: true } | { ok: false; reason: string };

/** Validate a slug the dealer typed (does NOT check DB availability). */
export function validateDealerSlug(slug: string): SlugValidation {
  if (slug.length < SLUG_MIN) return { ok: false, reason: `Use at least ${SLUG_MIN} characters.` };
  if (slug.length > SLUG_MAX) return { ok: false, reason: `Use at most ${SLUG_MAX} characters.` };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      reason: "Lowercase letters, numbers and single hyphens only — no leading, trailing or double hyphens.",
    };
  }
  if (RESERVED_DEALER_SLUGS.has(slug)) {
    return { ok: false, reason: "This name is reserved. Please choose another." };
  }
  return { ok: true };
}

/** Normalise any text to the slug charset and cap at 60 chars (no trailing hyphen). */
export function normalizeDealerSlug(input: string): string {
  const s = slugify(input);
  return s.length <= SLUG_MAX ? s : s.slice(0, SLUG_MAX).replace(/-+$/, "");
}

export interface GenerateDealerSlugParams {
  businessName: string;
  localityName?: string | null;
  cityName?: string | null;
  /** True when a slug is already used by another dealer (current or historical)
   *  OR is a reserved word. Callers pass a DB/Set-backed check. */
  isTaken: (slug: string) => boolean;
}

/**
 * Generate a unique dealer slug. Candidate order (first FREE one wins):
 *   1. businessName + locality
 *   2. businessName + city
 *   3. businessName + locality + city
 *   4. else: numeric suffix on the most specific candidate (-2, -3, …)
 */
export function generateDealerSlug(params: GenerateDealerSlugParams): string {
  const { businessName, localityName, cityName, isTaken } = params;

  const candidates: string[] = [];
  if (localityName) candidates.push(normalizeDealerSlug(`${businessName} ${localityName}`));
  if (cityName) candidates.push(normalizeDealerSlug(`${businessName} ${cityName}`));
  if (localityName && cityName) {
    candidates.push(normalizeDealerSlug(`${businessName} ${localityName} ${cityName}`));
  }
  if (candidates.length === 0) candidates.push(normalizeDealerSlug(businessName));

  const taken = (s: string) => RESERVED_DEALER_SLUGS.has(s) || isTaken(s);

  for (const c of candidates) {
    if (c && !taken(c)) return c;
  }

  // Numeric suffix on the most specific candidate, kept within 60 chars.
  const base = candidates[candidates.length - 1] || "dealer";
  const withSuffix = (n: number): string => {
    const suffix = `-${n}`;
    const room = SLUG_MAX - suffix.length;
    const head = base.length > room ? base.slice(0, room).replace(/-+$/, "") : base;
    return `${head}${suffix}`;
  };
  let n = 2;
  while (taken(withSuffix(n))) n++;
  return withSuffix(n);
}
