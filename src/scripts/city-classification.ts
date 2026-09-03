import { slugify } from "@/lib/utils/slug";

/**
 * City tier classification for the seed (DEV-SPEC.txt seed brief):
 *   tier 1 = metros
 *   tier 2 = state/UT capitals AND cities over ~1 million population
 *   tier 3 = everything else (the default)
 *
 * The India Post pincode dataset carries no population figures, so tier 1 and 2
 * membership is a curated list, not derived data:
 *   - TIER1: the eight metropolitan cities.
 *   - TIER2: all state/UT capitals plus the Census-2011 million-plus urban
 *     agglomerations.
 * We match on the slug of the dataset's district name (our "city"), with a few
 * alias entries so both the old and renamed forms resolve (Bangalore/Bengaluru,
 * Gurgaon/Gurugram, Allahabad/Prayagraj, Mysore/Mysuru, …). This list is
 * intentionally easy to audit and extend; getting a handful of cities one tier
 * off does not affect correctness, only default prominence.
 */

const TIER1 = new Set(
  [
    "mumbai",
    "mumbai-suburban",
    "delhi",
    "new-delhi",
    "central-delhi",
    "north-delhi",
    "south-delhi",
    "east-delhi",
    "west-delhi",
    "kolkata",
    "chennai",
    "bengaluru",
    "bengaluru-urban",
    "bangalore",
    "hyderabad",
    "ahmedabad",
    "pune",
  ].map((s) => s),
);

const TIER2 = new Set(
  [
    // --- State & UT capitals ---
    "amaravati",
    "itanagar",
    "dispur",
    "guwahati",
    "patna",
    "raipur",
    "panaji",
    "north-goa",
    "gandhinagar",
    "chandigarh",
    "shimla",
    "ranchi",
    "thiruvananthapuram",
    "bhopal",
    "imphal",
    "imphal-west",
    "shillong",
    "east-khasi-hills",
    "aizawl",
    "kohima",
    "bhubaneswar",
    "khordha",
    "jaipur",
    "gangtok",
    "agartala",
    "west-tripura",
    "lucknow",
    "dehradun",
    "port-blair",
    "south-andaman",
    "kavaratti",
    "lakshadweep",
    "puducherry",
    "srinagar",
    "leh",
    "jammu",
    "daman",
    "silvassa",
    // --- Census-2011 million-plus urban agglomerations (excl. tier-1) ---
    "surat",
    "kanpur",
    "kanpur-nagar",
    "nagpur",
    // NOTE: "aurangabad" is deliberately NOT here - it is ambiguous (a
    // million-plus city in Maharashtra, a small district in Bihar) and is
    // disambiguated by state via QUALIFIED below.
    "ghaziabad",
    "indore",
    "coimbatore",
    "kochi",
    "ernakulam",
    "kozhikode",
    "thrissur",
    "vadodara",
    "agra",
    "visakhapatnam",
    "malappuram",
    "kannur",
    "ludhiana",
    "nashik",
    "vijayawada",
    "madurai",
    "varanasi",
    "meerut",
    "faridabad",
    "rajkot",
    "jamshedpur",
    "east-singhbhum",
    "jabalpur",
    "asansol",
    "vasai-virar",
    "prayagraj",
    "allahabad",
    "dhanbad",
    "amritsar",
    "jodhpur",
    "kollam",
    "gwalior",
    "bhilai",
    "durg",
    "tiruchirappalli",
    "kota",
    "bareilly",
    "moradabad",
    "mysuru",
    "mysore",
    "solapur",
    "hubballi",
    "hubli",
    "dharwad",
    "salem",
    "warangal",
    "guntur",
    "bhiwandi",
    "saharanpur",
    "gorakhpur",
    "bikaner",
    "amravati",
    "noida",
    "gautam-buddha-nagar",
    "jalandhar",
    "jammu-city",
    "mangaluru",
    "mangalore",
    "dakshina-kannada",
    "belagavi",
    "belgaum",
    "tirunelveli",
    "gurugram",
    "gurgaon",
  ].map((s) => s),
);

/**
 * State-qualified overrides for names that collide across states where only one
 * is the large city. Keyed `${citySlug}::${stateSlug}`. Without this, a bare
 * name match would tag both same-named districts the same tier and the seed's
 * collision rule could hand the plain slug to the wrong (smaller) city.
 */
const QUALIFIED: Record<string, 1 | 2 | 3> = {
  // Aurangabad, Maharashtra is million-plus (tier 2); Aurangabad, Bihar is not.
  "aurangabad::maharashtra": 2,
};

/**
 * Resolve a tier from the raw district name (and, when known, its state so
 * ambiguous names resolve correctly). Slugified internally, so callers can pass
 * the dataset values directly.
 */
export function classifyCityTier(districtName: string, stateName = ""): 1 | 2 | 3 {
  const slug = slugify(districtName);

  if (stateName) {
    const qualified = QUALIFIED[`${slug}::${slugify(stateName)}`];
    if (qualified) return qualified;
  }

  if (TIER1.has(slug)) return 1;
  if (TIER2.has(slug)) return 2;
  return 3;
}
