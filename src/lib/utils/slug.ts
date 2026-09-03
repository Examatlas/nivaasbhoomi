import { nanoidLower } from "@/lib/utils/id";

/**
 * Slug and id rules - DEV-SPEC.txt Section 6.
 *
 * These slugs are the backbone of the whole SEO taxonomy: once a city, locality
 * or listing slug is assigned it must NEVER change (Section 6), because every
 * indexed URL and internal link depends on it. So the generators here are
 * deterministic and their collision behaviour is exact and tested.
 */

/**
 * General-purpose slugify. Lowercase, hyphen-separated, ASCII.
 *
 * Tuned for Indian place names:
 *  - strips diacritics ("Puḍucēri" -> "puducheri") so transliterated names
 *    normalise,
 *  - drops "." and "'" without inserting a hyphen ("St. Thomas" -> "st-thomas",
 *    but "N.S.C. Bose" collapses cleanly),
 *  - collapses any run of other separators (space, /, (), &) to a single hyphen,
 *  - trims leading/trailing hyphens.
 */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      // remove combining marks left by NFKD (U+0300–U+036F)
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      // apostrophes (straight and curly) and dots vanish rather than separating
      .replace(/['’.]/g, "")
      // everything else that isn't a-z0-9 becomes a separator
      .replace(/[^a-z0-9]+/g, "-")
      // squeeze repeats and trim
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

/**
 * City slug with collision handling (Section 6).
 *
 *   base = slugify(cityName)
 *   if no existing city already holds `base` -> base
 *   else -> base + '-' + slugify(stateName)
 *
 * `isTaken` reports whether a slug is already assigned. During seeding this is a
 * lookup into the in-memory set of slugs assigned so far; at runtime it is a DB
 * existence check. Cities MUST be fed highest-priority-first (tier 1 before 2
 * before 3) so the higher-tier city keeps the plain slug and the later collider
 * gets the state suffix - exactly the spec's "Aurangabad Maharashtra ->
 * aurangabad, Aurangabad Bihar -> aurangabad-bihar" rule.
 *
 * Defensive tail: if the state-suffixed slug is itself already taken (two
 * districts of the same name in the same state, or a prior manual slug), append
 * a numeric counter so we always return something unique rather than silently
 * colliding.
 */
export function generateCitySlug(
  cityName: string,
  stateName: string,
  isTaken: (slug: string) => boolean = () => false,
): string {
  const base = slugify(cityName);

  if (!isTaken(base)) return base;

  const withState = `${base}-${slugify(stateName)}`;
  if (!isTaken(withState)) return withState;

  let n = 2;
  while (isTaken(`${withState}-${n}`)) n++;
  return `${withState}-${n}`;
}

/**
 * Locality slug (Section 6). Unique WITHIN a city only, enforced by the
 * { cityId, slug } compound index - "kanke-road" may exist in both Ranchi and
 * Patna. `isTakenInCity` scopes the uniqueness check to one city; on collision
 * within the same city we append a numeric counter.
 */
export function generateLocalitySlug(
  localityName: string,
  isTakenInCity: (slug: string) => boolean = () => false,
): string {
  const base = slugify(localityName);
  if (!isTakenInCity(base)) return base;

  let n = 2;
  while (isTakenInCity(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Humanise a rupee amount for a listing slug (Section 6):
 *   5_200_000  -> "52-lakh"
 *   12_500_000 -> "1-25-crore"   (decimals become hyphen-joined)
 *   8_500_000  -> "85-lakh"
 *   95_000     -> "95000"        (below a lakh: plain number)
 *
 * Rent uses a separate "k" form via humanizeRentForSlug.
 */
export function humanizePriceForSlug(value: number): string {
  const LAKH = 100_000;
  const CRORE = 10_000_000;

  const format = (n: number, unit: string): string => {
    // Trim trailing zeros: 1.50 -> "1-25"? No: 1.5 -> "1-5", 1.25 -> "1-25".
    const rounded = Number(n.toFixed(2));
    const [whole, frac] = String(rounded).split(".");
    const digits = frac ? `${whole}-${frac}` : whole;
    return `${digits}-${unit}`;
  };

  if (value >= CRORE) return format(value / CRORE, "crore");
  if (value >= LAKH) return format(value / LAKH, "lakh");
  return String(Math.round(value));
}

/** Rent form for slugs: 25_000 -> "25k-rent", 8_500 -> "8500-rent". */
export function humanizeRentForSlug(value: number): string {
  if (value >= 1000 && value % 1000 === 0) {
    return `${value / 1000}k-rent`;
  }
  if (value >= 1000) {
    // Non-round thousands: keep one decimal, e.g. 12500 -> "12-5k-rent".
    const k = Number((value / 1000).toFixed(1));
    const [whole, frac] = String(k).split(".");
    return frac ? `${whole}-${frac}k-rent` : `${whole}k-rent`;
  }
  return `${Math.round(value)}-rent`;
}

export interface ListingSlugParams {
  bhk?: string; // '1rk','1','2','3','4','5plus' - omitted for plots
  propertyType: string; // 'flat','plot',...
  localitySlug: string; // already-slugified locality
  citySlug: string; // already-slugified city
  purpose: "sale" | "rent";
  price: number; // expectedPrice for sale, monthlyRent for rent
}

/**
 * Listing slug (Section 6):
 *   {bhk}-{propertyType}-{locality}-{city}-{price}-{nanoid6}
 *   e.g. 3-bhk-flat-kanke-road-ranchi-52-lakh-a7x9k2
 *
 * The nanoid(6) tail guarantees global uniqueness so two identical listings in
 * the same locality never collide. Per the spec this slug is generated ONCE and
 * never regenerated on edit - not even when the price changes - so URLs stay
 * stable for SEO. Callers persist it and pass it through unchanged thereafter.
 */
export function generateListingSlug(params: ListingSlugParams): string {
  const { bhk, propertyType, localitySlug, citySlug, purpose, price } = params;

  const pricePart =
    purpose === "rent" ? humanizeRentForSlug(price) : humanizePriceForSlug(price);

  const parts = [
    // "1rk" reads as "1rk"; numeric bhk becomes "3-bhk". Plots pass no bhk.
    bhk ? (bhk === "1rk" ? "1rk" : `${bhk}-bhk`) : null,
    slugify(propertyType),
    localitySlug,
    citySlug,
    pricePart,
    nanoidLower(6),
  ].filter(Boolean);

  return parts.join("-");
}
