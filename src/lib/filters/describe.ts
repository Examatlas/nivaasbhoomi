import type { FilterQuery } from "@/lib/filters/parse";
import { priceLabelForTitle } from "@/lib/seo/site";

/**
 * Human labels for a parsed FilterQuery - used in filter-page titles, H1s and
 * breadcrumbs (DEV-SPEC.txt Section 10 metadata).
 */

const TYPE_PLURAL: Record<string, string> = {
  flat: "Flats",
  "independent-house": "Independent Houses",
  villa: "Villas",
  plot: "Plots",
  "commercial-shop": "Shops",
  office: "Offices",
  pg: "PGs",
  warehouse: "Warehouses",
};

export function propertyTypePlural(type: string): string {
  return TYPE_PLURAL[type] ?? type;
}

export function bhkLabel(bhk: string): string {
  if (bhk === "1rk") return "1 RK";
  if (bhk === "5plus") return "5+ BHK";
  return `${bhk} BHK`;
}

/** "3 BHK Flats for Rent", "Furnished Flats for Rent", "Flats under ₹50 Lakh". */
export function describeFilter(filter: FilterQuery): string {
  const parts: string[] = [];
  if (filter.bhk) parts.push(bhkLabel(filter.bhk));
  if (filter.furnishing) {
    parts.push(
      filter.furnishing === "semi-furnished"
        ? "Semi-furnished"
        : titleCase(filter.furnishing),
    );
  }
  parts.push(propertyTypePlural(filter.propertyType));

  let label = parts.join(" ");
  if (filter.purpose) label += filter.purpose === "rent" ? " for Rent" : " for Sale";
  if (filter.maxPrice) label += ` under ₹${priceLabelForTitle(filter.maxPrice)}`;
  return label;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
