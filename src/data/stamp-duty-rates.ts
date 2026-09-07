/**
 * VERSIONED stamp-duty + registration rate data (Phase 1 lead-magnet tool).
 *
 * SOURCING RULE: numbers are researched residential-urban figures with the
 * state's OFFICIAL registration/IGR portal recorded as `source`. State portals
 * do not publish a machine-readable rate table (they expose a login-gated
 * calculator), so these are strong multi-source consensus figures to be
 * confirmed against the portal — NEVER invented. Where sources genuinely
 * conflicted (e.g. Madhya Pradesh) the rate is left `null` and the UI shows
 * "data coming soon". Every page carries an "estimate — confirm at the
 * sub-registrar office" disclaimer and the `lastUpdated` date.
 *
 * `stampDuty` percentages are the buyer's-eye effective DUTY (cess / transfer
 * duty folded in where a state levies them, noted in `note`). Registration is
 * a separate line. Female/joint concessions are per state.
 */

export interface StampDutyRates {
  male: number;
  female: number;
  joint: number;
}

export interface StateStampDuty {
  slug: string;
  name: string;
  code: string;
  /** null = not reliably verified yet → calculator shows "coming soon". */
  stampDuty: StampDutyRates | null;
  /** Registration charge % (null only when the whole entry is unverified). */
  registrationPct: number | null;
  /** Human note shown under the result (caps, cesses, slab caveats). */
  note?: string;
  /** Registration cap, shown as context (not applied to the estimate). */
  registrationCap?: string;
  lastUpdated: string; // ISO date
  source: string; // official portal URL
}

const PORTAL_UNKNOWN = "";

/** Keyed by state slug (matches State.slug / state-codes.ts). */
export const STAMP_DUTY_BY_SLUG: Record<string, StateStampDuty> = {
  maharashtra: {
    slug: "maharashtra", name: "Maharashtra", code: "MH",
    stampDuty: { male: 6, female: 5, joint: 6 }, registrationPct: 1,
    registrationCap: "₹30,000",
    note: "Mumbai rate (includes 1% metro cess). Pune/Nagpur are ~7% with local cess. The 1% women's concession applies when all owners are women.",
    lastUpdated: "2026-01-01", source: "https://igrmaharashtra.gov.in/",
  },
  karnataka: {
    slug: "karnataka", name: "Karnataka", code: "KA",
    stampDuty: { male: 5, female: 5, joint: 5 }, registrationPct: 2,
    note: "5% applies above ₹45 lakh (slab: 2% up to ₹20L, 3% ₹20–45L), plus cess & surcharge. No women's concession (removed 2024). Registration raised to 2% from Aug 2025.",
    lastUpdated: "2026-01-01", source: "https://kaverionline.karnataka.gov.in/",
  },
  delhi: {
    slug: "delhi", name: "Delhi", code: "DL",
    stampDuty: { male: 6, female: 4, joint: 5 }, registrationPct: 1,
    note: "Charged on circle rate or transaction value, whichever is higher.",
    lastUpdated: "2026-01-01", source: "https://ngdrsservices.delhigovt.nic.in/",
  },
  "uttar-pradesh": {
    slug: "uttar-pradesh", name: "Uttar Pradesh", code: "UP",
    stampDuty: { male: 7, female: 6, joint: 6.5 }, registrationPct: 1,
    note: "Women's 1% concession applies on property value up to ₹1 crore.",
    lastUpdated: "2026-01-01", source: "https://igrsup.gov.in/",
  },
  "tamil-nadu": {
    slug: "tamil-nadu", name: "Tamil Nadu", code: "TN",
    stampDuty: { male: 7, female: 7, joint: 7 }, registrationPct: 4,
    note: "Registration fee is an unusually high 4%. No gender concession on stamp duty; women pay 3% registration up to ₹10 lakh.",
    lastUpdated: "2026-01-01", source: "https://tnreginet.gov.in/",
  },
  telangana: {
    slug: "telangana", name: "Telangana", code: "TS",
    stampDuty: { male: 5.5, female: 5.5, joint: 5.5 }, registrationPct: 0.5,
    note: "Effective duty includes 1.5% transfer duty. No gender concession. Rural areas differ.",
    lastUpdated: "2026-01-01", source: "https://registration.telangana.gov.in/",
  },
  gujarat: {
    slug: "gujarat", name: "Gujarat", code: "GJ",
    stampDuty: { male: 4.9, female: 4.9, joint: 4.9 }, registrationPct: 1,
    note: "Sole female buyers: the 1% registration fee is waived. Duty includes surcharge.",
    lastUpdated: "2026-01-01", source: "https://garvi.gujarat.gov.in/",
  },
  rajasthan: {
    slug: "rajasthan", name: "Rajasthan", code: "RJ",
    stampDuty: { male: 6, female: 4.8, joint: 6 }, registrationPct: 1,
    note: "Effective rate including the 20% labour cess on duty (base is 5% male / 4% female).",
    lastUpdated: "2026-01-01", source: "https://epanjiyan.rajasthan.gov.in/",
  },
  "west-bengal": {
    slug: "west-bengal", name: "West Bengal", code: "WB",
    stampDuty: { male: 6, female: 6, joint: 6 }, registrationPct: 1,
    note: "Urban rate up to ₹1 crore; 7% above ₹1 crore. Rural is ~1% lower. No gender concession.",
    lastUpdated: "2026-01-01", source: "https://wbregistration.gov.in/",
  },
  haryana: {
    slug: "haryana", name: "Haryana", code: "HR",
    stampDuty: { male: 7, female: 5, joint: 6 }, registrationPct: 1,
    registrationCap: "₹50,000",
    note: "Urban rates; rural is 5% / 3% / 4% (male / female / joint).",
    lastUpdated: "2026-01-01", source: "https://jamabandi.nic.in/",
  },
  punjab: {
    slug: "punjab", name: "Punjab", code: "PB",
    stampDuty: { male: 7, female: 5, joint: 6 }, registrationPct: 1,
    note: "Duty includes social-security and infrastructure cess.",
    lastUpdated: "2026-01-01", source: "https://eregistration.punjab.gov.in/",
  },
  kerala: {
    slug: "kerala", name: "Kerala", code: "KL",
    stampDuty: { male: 8, female: 8, joint: 8 }, registrationPct: 2,
    note: "No gender concession. Charged on the higher of consideration or fair value.",
    lastUpdated: "2026-01-01", source: "https://registration.kerala.gov.in/",
  },
  bihar: {
    // The 6.3% / 5.7% figures are aggregator-derived; the official portal
    // (bhumijankari.bihar.gov.in) publishes no rate table, so we do NOT show a
    // number until it can be confirmed on the official / eNibandhan portal.
    slug: "bihar", name: "Bihar", code: "BR",
    stampDuty: null, registrationPct: null,
    note: "Rate data is being confirmed against the official Bihar registration (eNibandhan) portal.",
    lastUpdated: "2026-01-01", source: "https://bhumijankari.bihar.gov.in/",
  },
  "andhra-pradesh": {
    slug: "andhra-pradesh", name: "Andhra Pradesh", code: "AP",
    stampDuty: { male: 6.5, female: 6.5, joint: 6.5 }, registrationPct: 1,
    note: "Effective duty includes 1.5% transfer duty. No gender concession.",
    lastUpdated: "2026-01-01", source: "https://registration.ap.gov.in/",
  },
  odisha: {
    slug: "odisha", name: "Odisha", code: "OD",
    stampDuty: { male: 5, female: 4, joint: 5 }, registrationPct: 2,
    note: "Women get a 1% stamp-duty concession.",
    lastUpdated: "2026-01-01", source: "https://igrodisha.gov.in/",
  },
  jharkhand: {
    slug: "jharkhand", name: "Jharkhand", code: "JH",
    stampDuty: { male: 4, female: 4, joint: 4 }, registrationPct: 3,
    note: "No women's concession (the earlier token waiver was rolled back in 2020).",
    lastUpdated: "2026-01-01", source: "https://regd.jharkhand.gov.in/",
  },
  uttarakhand: {
    slug: "uttarakhand", name: "Uttarakhand", code: "UK",
    stampDuty: { male: 5, female: 3.75, joint: 5 }, registrationPct: 2,
    registrationCap: "₹25,000",
    note: "Women's 3.75% rate applies only up to ₹25 lakh, twice in a lifetime; above that the standard 5% applies.",
    lastUpdated: "2026-01-01", source: "https://registration.uk.gov.in/",
  },
  "himachal-pradesh": {
    slug: "himachal-pradesh", name: "Himachal Pradesh", code: "HP",
    stampDuty: { male: 6, female: 4, joint: 5 }, registrationPct: 2,
    registrationCap: "₹25,000",
    note: "Rates for property up to ₹50 lakh; 8% for all categories above ₹50 lakh.",
    lastUpdated: "2026-01-01", source: "https://himachal.nic.in/",
  },
  chhattisgarh: {
    slug: "chhattisgarh", name: "Chhattisgarh", code: "CG",
    stampDuty: { male: 5, female: 4, joint: 5 }, registrationPct: 4,
    note: "High registration fee (4%). Women get a 50% registration-fee cut from FY 2026-27.",
    lastUpdated: "2026-01-01", source: "https://epanjeeyan.cg.gov.in/",
  },

  // ---- Verification pending: sources genuinely conflict → shown as "coming soon" ----
  "madhya-pradesh": {
    slug: "madhya-pradesh", name: "Madhya Pradesh", code: "MP",
    stampDuty: null, registrationPct: null,
    note: "Rate data is being verified against the official SAMPADA / MPIGR portal.",
    lastUpdated: "2026-01-01", source: "https://www.mpigr.gov.in/",
  },
  goa: {
    slug: "goa", name: "Goa", code: "GA",
    stampDuty: null, registrationPct: null,
    lastUpdated: "2026-01-01", source: PORTAL_UNKNOWN,
  },
  assam: {
    slug: "assam", name: "Assam", code: "AS",
    stampDuty: null, registrationPct: null,
    lastUpdated: "2026-01-01", source: PORTAL_UNKNOWN,
  },
};

/** Resolve a state's rate entry by slug (null when we have no entry at all). */
export function getStateStampDuty(slug: string): StateStampDuty | null {
  return STAMP_DUTY_BY_SLUG[slug] ?? null;
}

/** All states we surface in the tool (sorted by name), for the picker + sitemap. */
export function allStampDutyStates(): StateStampDuty[] {
  return Object.values(STAMP_DUTY_BY_SLUG).sort((a, b) => a.name.localeCompare(b.name));
}

/** Only states with a verified rate (for "supported states" lists). */
export function statesWithRates(): StateStampDuty[] {
  return allStampDutyStates().filter((s) => s.stampDuty !== null);
}
