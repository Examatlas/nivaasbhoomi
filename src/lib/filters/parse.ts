/**
 * Filter-segment parsing (DEV-SPEC.txt Section 9).
 *
 * The third URL segment of /[city]/[locality]/[filter] is parsed into a query
 * object by an ORDERED registry of regex patterns. Anything that does not match
 * a registered pattern returns { matched: false } and the page MUST call
 * notFound() - this is the guard against infinite junk URLs being indexed.
 *
 * Only the exact patterns listed in Section 9 are accepted:
 *   flats                      -> propertyType
 *   plots                      -> propertyType
 *   3-bhk-flats                -> bhk + propertyType
 *   flats-for-rent             -> propertyType + purpose
 *   3-bhk-flats-for-rent       -> bhk + propertyType + purpose
 *   flats-under-50-lakh        -> propertyType + maxPrice
 *   furnished-flats-for-rent   -> furnishing + propertyType + purpose
 */

export type Purpose = "sale" | "rent";
export type Furnishing = "furnished" | "semi-furnished" | "unfurnished";

export interface FilterQuery {
  propertyType: string;
  bhk?: string;
  purpose?: Purpose;
  furnishing?: Furnishing;
  maxPrice?: number;
}

export type ParseResult = { matched: true; filter: FilterQuery } | { matched: false };

/** URL plural/slug -> Listing.propertyType enum value. */
const PROPERTY_TYPE_BY_SLUG: Record<string, string> = {
  flats: "flat",
  plots: "plot",
  villas: "villa",
  "independent-houses": "independent-house",
  shops: "commercial-shop",
  "commercial-shops": "commercial-shop",
  offices: "office",
  pgs: "pg",
  pg: "pg",
  warehouses: "warehouse",
};

/** URL bhk token -> Listing.bhk enum value ('1rk','1'..'4','5plus'). */
const BHK_BY_SLUG: Record<string, string> = {
  "1-rk": "1rk",
  "1-bhk": "1",
  "2-bhk": "2",
  "3-bhk": "3",
  "4-bhk": "4",
  "5-bhk": "5plus",
  "5-plus-bhk": "5plus",
};

// Regex fragments (kept as source strings so we can compose them).
const TYPE =
  "(flats|plots|villas|independent-houses|commercial-shops|shops|offices|pgs|warehouses)";
const BHK = "(1-rk|1-bhk|2-bhk|3-bhk|4-bhk|5-bhk|5-plus-bhk)";
const FURN = "(furnished|semi-furnished|unfurnished)";
const PURPOSE = "for-(sale|rent)";
const BUDGET = "under-(\\d{1,4}(?:-\\d{1,2})?)-(lakh|crore)";

function toPropertyType(slug: string): string | null {
  return PROPERTY_TYPE_BY_SLUG[slug] ?? null;
}
function toBhk(slug: string): string | null {
  return BHK_BY_SLUG[slug] ?? null;
}

/** "50","lakh" -> 5000000 ; "1-5","crore" -> 15000000 (1.5 crore). */
function toMaxPrice(numToken: string, unit: string): number {
  const decimal = Number(numToken.replace("-", "."));
  const mult = unit === "crore" ? 10_000_000 : 100_000;
  return Math.round(decimal * mult);
}

interface Pattern {
  re: RegExp;
  build: (m: RegExpMatchArray) => FilterQuery | null;
}

/**
 * Ordered registry. Every pattern is fully anchored, so ordering only matters
 * where two could match the same string - it does not here, but we keep the
 * more specific (more tokens) patterns first for clarity.
 */
export const FILTER_PATTERNS: Pattern[] = [
  // bhk + propertyType + purpose   e.g. 3-bhk-flats-for-rent
  {
    re: new RegExp(`^${BHK}-${TYPE}-${PURPOSE}$`),
    build: (m) => {
      const bhk = toBhk(m[1]!);
      const propertyType = toPropertyType(m[2]!);
      if (!bhk || !propertyType) return null;
      return { propertyType, bhk, purpose: m[3] as Purpose };
    },
  },
  // furnishing + propertyType + purpose   e.g. furnished-flats-for-rent
  {
    re: new RegExp(`^${FURN}-${TYPE}-${PURPOSE}$`),
    build: (m) => {
      const propertyType = toPropertyType(m[2]!);
      if (!propertyType) return null;
      return { propertyType, furnishing: m[1] as Furnishing, purpose: m[3] as Purpose };
    },
  },
  // bhk + propertyType   e.g. 3-bhk-flats
  {
    re: new RegExp(`^${BHK}-${TYPE}$`),
    build: (m) => {
      const bhk = toBhk(m[1]!);
      const propertyType = toPropertyType(m[2]!);
      if (!bhk || !propertyType) return null;
      return { propertyType, bhk };
    },
  },
  // propertyType + purpose   e.g. flats-for-rent
  {
    re: new RegExp(`^${TYPE}-${PURPOSE}$`),
    build: (m) => {
      const propertyType = toPropertyType(m[1]!);
      if (!propertyType) return null;
      return { propertyType, purpose: m[2] as Purpose };
    },
  },
  // propertyType + budget   e.g. flats-under-50-lakh
  {
    re: new RegExp(`^${TYPE}-${BUDGET}$`),
    build: (m) => {
      const propertyType = toPropertyType(m[1]!);
      if (!propertyType) return null;
      return { propertyType, maxPrice: toMaxPrice(m[2]!, m[3]!) };
    },
  },
  // propertyType alone   e.g. flats, plots
  {
    re: new RegExp(`^${TYPE}$`),
    build: (m) => {
      const propertyType = toPropertyType(m[1]!);
      if (!propertyType) return null;
      return { propertyType };
    },
  },
];

/**
 * Parse the third URL segment. Returns { matched:false } for anything not in the
 * registry - the caller then calls notFound().
 */
export function parseFilterSegment(segment: string): ParseResult {
  if (!segment) return { matched: false };
  const s = segment.toLowerCase();

  for (const { re, build } of FILTER_PATTERNS) {
    const m = s.match(re);
    if (m) {
      const filter = build(m);
      if (filter) return { matched: true, filter };
    }
  }
  return { matched: false };
}
