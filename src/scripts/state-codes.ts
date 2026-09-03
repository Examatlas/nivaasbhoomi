import { slugify } from "@/lib/utils/slug";

/**
 * State / UT -> official 2-letter code. The India Post pincode dataset does not
 * carry the code, and State.code is required (Section 4), so we map it here.
 * Keyed by the slug of the state name, with alias entries for the punctuation
 * and spelling variants different dataset mirrors use ("Andaman & Nicobar
 * Islands" vs "Andaman Nicobar", "Orissa" vs "Odisha", etc.).
 */
const CODE_BY_SLUG: Record<string, string> = {
  "andhra-pradesh": "AP",
  "arunachal-pradesh": "AR",
  assam: "AS",
  bihar: "BR",
  chhattisgarh: "CG",
  chhatisgarh: "CG",
  goa: "GA",
  gujarat: "GJ",
  haryana: "HR",
  "himachal-pradesh": "HP",
  jharkhand: "JH",
  karnataka: "KA",
  kerala: "KL",
  "madhya-pradesh": "MP",
  maharashtra: "MH",
  manipur: "MN",
  meghalaya: "ML",
  mizoram: "MZ",
  nagaland: "NL",
  odisha: "OD",
  orissa: "OD",
  punjab: "PB",
  rajasthan: "RJ",
  sikkim: "SK",
  "tamil-nadu": "TN",
  telangana: "TS",
  tripura: "TR",
  "uttar-pradesh": "UP",
  uttarakhand: "UK",
  uttaranchal: "UK",
  "west-bengal": "WB",
  // Union Territories
  "andaman-nicobar-islands": "AN",
  "andaman-nicobar": "AN",
  "andaman-and-nicobar-islands": "AN",
  chandigarh: "CH",
  "dadra-and-nagar-haveli-and-daman-and-diu": "DN",
  // India Post names this UT with a leading "The".
  "the-dadra-and-nagar-haveli-and-daman-and-diu": "DN",
  "dadra-nagar-haveli": "DN",
  "daman-diu": "DD",
  "daman-and-diu": "DD",
  delhi: "DL",
  "nct-of-delhi": "DL",
  "jammu-and-kashmir": "JK",
  "jammu-kashmir": "JK",
  ladakh: "LA",
  lakshadweep: "LD",
  puducherry: "PY",
  pondicherry: "PY",
};

/**
 * Resolve a 2-letter code from a raw state name. Falls back to an initials-based
 * code (first letters of up to two words) so an unmapped or newly-created
 * state/UT still satisfies the required field rather than failing the seed.
 */
export function resolveStateCode(stateName: string): string {
  const slug = slugify(stateName);
  const known = CODE_BY_SLUG[slug];
  if (known) return known;

  const words = slug.split("-").filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return (words[0] ?? "xx").slice(0, 2).toUpperCase();
}
