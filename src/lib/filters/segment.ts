import type { FilterQuery } from "@/lib/filters/parse";

/**
 * Build a canonical filter URL segment from a FilterQuery - the inverse of
 * parseFilterSegment. Used to link to filter pages from the locality page and
 * to enumerate valid combinations in generateStaticParams. Only produces the
 * shapes the parser accepts (Section 9); budget segments are not generated here
 * (they are validated + thin-page-guarded on demand).
 */

const TYPE_TO_SLUG: Record<string, string> = {
  flat: "flats",
  "independent-house": "independent-houses",
  villa: "villas",
  plot: "plots",
  "commercial-shop": "commercial-shops",
  office: "offices",
  pg: "pgs",
  warehouse: "warehouses",
  farmhouse: "farm-houses",
};

const BHK_TO_TOKEN: Record<string, string> = {
  "1rk": "1-rk",
  "1": "1-bhk",
  "2": "2-bhk",
  "3": "3-bhk",
  "4": "4-bhk",
  "5plus": "5-plus-bhk",
};

export function propertyTypeSlug(type: string): string | null {
  return TYPE_TO_SLUG[type] ?? null;
}

export function bhkToken(bhk: string): string | null {
  return BHK_TO_TOKEN[bhk] ?? null;
}

/**
 * Returns the segment, or null if the query can't be expressed as one of the
 * parser's supported shapes.
 */
export function filterToSegment(filter: FilterQuery): string | null {
  const type = propertyTypeSlug(filter.propertyType);
  if (!type) return null;

  const parts: string[] = [];
  if (filter.bhk) {
    const t = bhkToken(filter.bhk);
    if (!t) return null;
    parts.push(t);
  } else if (filter.furnishing) {
    parts.push(filter.furnishing);
  }
  parts.push(type);
  if (filter.purpose) parts.push(`for-${filter.purpose}`);

  const segment = parts.join("-");

  // Guard: only bhk+type(+purpose), furnishing+type+purpose, type(+purpose)
  // are valid. furnishing requires a purpose.
  if (filter.furnishing && !filter.purpose) return null;
  return segment;
}
