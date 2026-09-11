/**
 * Indian price and area formatting.
 *
 * Buyers here read in lakh/crore, not millions. Rendering "5,200,000" instead
 * of "52 L" is one of the small ways a portal signals it was not built for
 * this market. Grouping uses the Indian 2-2-3 comma system throughout.
 */

const LAKH = 100_000;
const CRORE = 10_000_000;

const inrGroup = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** 5200000 -> "52,00,000" (Indian 2-2-3 grouping, no symbol). */
export function groupINR(value: number): string {
  return inrGroup.format(Math.round(value));
}

/**
 * Trim trailing zeros from a decimal so we render "1.5 Cr" not "1.50 Cr",
 * and "52 L" not "52.0 L".
 */
function trimDecimal(value: number, maxDecimals: number): string {
  return String(Number(value.toFixed(maxDecimals)));
}

export interface FormatPriceOptions {
  /** "short" -> "52 L" / "1.25 Cr". "long" -> "52 Lakh" / "1.25 Crore". */
  style?: "short" | "long";
}

/**
 * Compact sale price for cards and headings.
 *
 *   85000     -> "Rs 85,000"
 *   5200000   -> "Rs 52 L"
 *   12500000  -> "Rs 1.25 Cr"
 *
 * Below one lakh we show the exact figure - rounding a 85,000 plot to "0.9 L"
 * would read as evasive, and trust is the whole product.
 */
export function formatPrice(value: number, options: FormatPriceOptions = {}): string {
  const { style = "short" } = options;

  if (!Number.isFinite(value) || value <= 0) return "Price on request";

  if (value >= CRORE) {
    const unit = style === "long" ? " Crore" : " Cr";
    return `₹${trimDecimal(value / CRORE, 2)}${unit}`;
  }

  if (value >= LAKH) {
    const unit = style === "long" ? " Lakh" : " L";
    return `₹${trimDecimal(value / LAKH, 2)}${unit}`;
  }

  return `₹${groupINR(value)}`;
}

/** Monthly rent. Always exact - renters compare to the rupee. */
export function formatRent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Rent on request";
  return `₹${groupINR(value)}`;
}

/**
 * Single entry point used by PropertyCard so sale and rent never diverge in
 * how they read. Rent carries its period inline; sale never does.
 */
export function formatListingPrice(
  purpose: "sale" | "rent",
  value: number,
): { primary: string; suffix?: string } {
  if (purpose === "rent") {
    return { primary: formatRent(value), suffix: "/month" };
  }
  return { primary: formatPrice(value) };
}

/** 1250 -> "1,250 sq.ft." */
export function formatArea(value: number, unit = "sq.ft."): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${groupINR(value)} ${unit}`;
}

/** 5200000 over 1250 sqft -> "Rs 4,160 / sq.ft." */
export function formatPricePerSqft(pricePerSqft: number): string {
  if (!Number.isFinite(pricePerSqft) || pricePerSqft <= 0) return "";
  return `₹${groupINR(pricePerSqft)} / sq.ft.`;
}

/** '2' -> "2 BHK", '1rk' -> "1 RK", '5plus' -> "5+ BHK". */
export function formatBhk(bhk: string): string {
  if (bhk === "1rk") return "1 RK";
  if (bhk === "5plus") return "5+ BHK";
  return `${bhk} BHK`;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  flat: "Flat",
  "independent-house": "Independent House",
  villa: "Villa",
  plot: "Plot",
  "commercial-shop": "Shop",
  office: "Office",
  pg: "PG",
  warehouse: "Warehouse",
  farmhouse: "Farm House",
};

export function formatPropertyType(type: string): string {
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

const FURNISHING_LABELS: Record<string, string> = {
  furnished: "Furnished",
  "semi-furnished": "Semi-furnished",
  unfurnished: "Unfurnished",
};

export function formatFurnishing(furnishing: string): string {
  return FURNISHING_LABELS[furnishing] ?? furnishing;
}

const BELOW_20 = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function words2(n: number): string {
  if (n < 20) return BELOW_20[n] ?? "";
  const t = TENS[Math.floor(n / 10)] ?? "";
  return n % 10 ? `${t} ${BELOW_20[n % 10] ?? ""}` : t;
}
function words3(n: number): string {
  if (n < 100) return words2(n);
  const h = BELOW_20[Math.floor(n / 100)] ?? "";
  return n % 100 ? `${h} Hundred ${words2(n % 100)}` : `${h} Hundred`;
}

/**
 * Indian-system amount in words: 500000 -> "Five Lakh",
 * 12500000 -> "One Crore Twenty Five Lakh". Returns "" for empty/zero/negative
 * so callers can hide the line; recurses on the crore group for very large values.
 */
export function inrWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  const n = Math.floor(value);
  if (n <= 0) return "";
  if (n < 1000) return words3(n);
  if (n < 100000) {
    const r = n % 1000;
    return `${words2(Math.floor(n / 1000))} Thousand${r ? ` ${words3(r)}` : ""}`;
  }
  if (n < 10000000) {
    const r = n % 100000;
    return `${words2(Math.floor(n / 100000))} Lakh${r ? ` ${inrWords(r)}` : ""}`;
  }
  const r = n % 10000000;
  return `${inrWords(Math.floor(n / 10000000))} Crore${r ? ` ${inrWords(r)}` : ""}`;
}
