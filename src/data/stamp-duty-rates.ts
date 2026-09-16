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

/** A full rate set (stamp duty by buyer + registration) for one area type. */
export interface AreaRate {
  stampDuty: StampDutyRates;
  registrationPct: number;
}

export interface StateStampDuty {
  slug: string;
  name: string;
  code: string;
  /** Flat rate — used when the state does NOT vary by area (the common case).
   *  null = not reliably verified yet → calculator shows "coming soon". */
  stampDuty: StampDutyRates | null;
  /** Registration charge % for the flat case (null only when unverified). */
  registrationPct: number | null;
  /**
   * Present ONLY when the rate genuinely differs by urban vs rural (e.g. Madhya
   * Pradesh's municipal vs janpad duty). When set it takes precedence over the
   * flat `stampDuty`/`registrationPct`, and the calculator treats the Area
   * selector as significant. Left undefined for the states where area makes no
   * difference — there the Area field is hidden.
   */
  areas?: { urban: AreaRate; rural: AreaRate };
  /** Human note shown under the result (caps, cesses, slab caveats). */
  note?: string;
  /** Registration cap, shown as context (not applied to the estimate). */
  registrationCap?: string;
  /**
   * Optional page-level caveat callout — used when a widely-quoted but
   * unofficial figure needs reconciling against the official one. Rendered
   * prominently on the state page alongside the official-portal link.
   */
  rateCaveat?: string;
  lastUpdated: string; // ISO date
  source: string; // official portal URL
}

export type AreaType = "urban" | "rural";
export type BuyerCategory = "male" | "female" | "joint";

/** The effective rate for a given buyer + area, resolved from either the flat
 *  or the area-wise data. */
export interface ResolvedStampDuty {
  stampDutyPct: number;
  registrationPct: number;
  /** The general/male rate for the SAME area, so a female/joint rebate shows. */
  baseStampDutyPct: number;
}

/** Whether a state's rate depends on urban vs rural. */
export function stampDutyVariesByArea(s: StateStampDuty): boolean {
  return Boolean(s.areas);
}

/** Whether a state has ANY verified rate (flat or area-wise). */
export function hasVerifiedRate(s: StateStampDuty): boolean {
  return Boolean(s.areas) || (s.stampDuty !== null && s.registrationPct !== null);
}

/**
 * Resolve the effective stamp-duty + registration for a buyer category and area.
 * Area-wise data wins; otherwise the flat rate is used for every area. Returns
 * null when the state has no verified rate at all (never guesses a number).
 */
export function resolveStampDutyRate(
  s: StateStampDuty,
  buyer: BuyerCategory,
  area: AreaType,
): ResolvedStampDuty | null {
  if (s.areas) {
    const a = s.areas[area];
    return {
      stampDutyPct: a.stampDuty[buyer],
      registrationPct: a.registrationPct,
      baseStampDutyPct: a.stampDuty.male,
    };
  }
  if (s.stampDuty && s.registrationPct != null) {
    return {
      stampDutyPct: s.stampDuty[buyer],
      registrationPct: s.registrationPct,
      baseStampDutyPct: s.stampDuty.male,
    };
  }
  return null;
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
    // VERIFIED against the official rate table published by the Bihar Dept. of
    // Prohibition, Excise & Registration (nibandhan.bihar.gov.in — "TABLE OF
    // STAMP DUTY & REGISTRATION FEE", Article 23 Conveyance). Bihar's rate keys
    // off the transfer DIRECTION, not just the buyer: male→female 5.7% + 1.9%,
    // female→male 6.3% + 2.1%, any other case 6% + 2%. Buyer-gender alone can't
    // express the female→male case, so a female buyer gets the 5.7% concession
    // and male/joint use the 6% "any other case"; registration is shown at the
    // standard 2% (the note carries the exact per-direction figures).
    slug: "bihar", name: "Bihar", code: "BR",
    stampDuty: { male: 6, female: 5.7, joint: 6 }, registrationPct: 2,
    note: "Official Bihar rates (Article 23) depend on the transfer direction: a sale from a male owner to a woman buyer is 5.7% stamp duty + 1.9% registration, woman to man is 6.3% + 2.1%, and any other case (including joint ownership) is 6% + 2%. Charged on the higher of the sale price or the Minimum Value Register (MVR). A 1% rebate (up to ₹2,000) applies to stamp duty paid through online registration. This calculator shows the women's stamp-duty concession with the standard 2% registration.",
    lastUpdated: "2026-09-16", source: "https://nibandhan.bihar.gov.in/",
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

  "madhya-pradesh": {
    // VERIFIED against the official MPIGR "Stamp Duty & Registration Fee Chart"
    // (Conveyance, SR 46-57). The rate is AREA-WISE, not gender-wise: principal
    // stamp duty 5% + a local-body duty (3% municipal in urban areas / 1% janpad
    // in rural areas) + 0.5% upkar (10% of the 5% principal) + 3% registration.
    //   urban = 5 + 3 + 0.5 = 8.5% stamp, 3% registration
    //   rural = 5 + 1 + 0.5 = 6.5% stamp, 3% registration
    // No women's concession on a normal sale (the chart's conveyance rows are
    // gender-uniform), so male = female = joint within each area.
    slug: "madhya-pradesh", name: "Madhya Pradesh", code: "MP",
    stampDuty: null, registrationPct: null,
    areas: {
      urban: { stampDuty: { male: 8.5, female: 8.5, joint: 8.5 }, registrationPct: 3 },
      rural: { stampDuty: { male: 6.5, female: 6.5, joint: 6.5 }, registrationPct: 3 },
    },
    note: "Madhya Pradesh's stamp duty is area-based (official MPIGR chart): 5% principal duty plus a 3% municipal duty in urban/municipal areas or a 1% janpad duty in rural/panchayat areas, plus a 0.5% upkar cess — so about 8.5% in urban areas and 6.5% in rural areas, with 3% registration in both. Charged on the higher of the price or the government guideline (collector) value. There is no separate women's concession on a normal sale.",
    rateCaveat: "Some websites list 7.5%. The official MPIGR chart works out to 8.5% in urban areas (5% conveyance + 3% municipal duty + 0.5% upkar). Always confirm with the official portal.",
    lastUpdated: "2026-09-16", source: "https://www.mpigr.gov.in/",
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

/** Only states with a verified rate — flat OR area-wise (for "supported" lists). */
export function statesWithRates(): StateStampDuty[] {
  return allStampDutyStates().filter(hasVerifiedRate);
}
