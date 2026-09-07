/**
 * Property-purchase LEGAL CHECKLIST data (Phase 2 lead magnet).
 *
 * A SHARED generic due-diligence checklist (standard, all-India property
 * verification) assembled per property/purchase type, PLUS verified per-state
 * additions (the real differentiator — e.g. Jharkhand CNT/SPT tribal-land
 * restrictions). State-specific legal content is only included when verified
 * against an official/authoritative source; otherwise the tool shows the generic
 * checklist only (kam info galat info se behtar). This is NOT legal advice.
 */

export type ChecklistPropertyType =
  | "flat"
  | "plot"
  | "independent_house"
  | "commercial"
  | "agricultural";
export type ChecklistPurchaseType = "new_builder" | "resale" | "under_construction";

export interface ChecklistItem {
  title: string;
  detail?: string;
}
export interface ChecklistSection {
  key: string;
  title: string;
  items: ChecklistItem[];
}

export interface StateLegalInfo {
  slug: string;
  name: string;
  /** Verified state-specific section — null when only generic info is available. */
  specific: { title: string; items: ChecklistItem[] } | null;
  /** State-specific red flags to append (verified). */
  redFlags?: string[];
  /** Official portals (registration / land records / RERA). */
  portals: { label: string; url: string }[];
  lastUpdated: string;
  sources: string[];
}

export const CHECKLIST_DISCLAIMER =
  "This is a general checklist, not legal advice. Before buying any property, consult a qualified property lawyer.";

// ---- labels ----
export const PROPERTY_TYPE_LABELS: Record<ChecklistPropertyType, string> = {
  flat: "Flat / apartment",
  plot: "Plot / land",
  independent_house: "Independent house",
  commercial: "Commercial",
  agricultural: "Agricultural land",
};
export const PURCHASE_TYPE_LABELS: Record<ChecklistPurchaseType, string> = {
  new_builder: "New from builder",
  resale: "Resale",
  under_construction: "Under construction",
};

// ---- generic base checklist (standard property due diligence) ----
// Each entry declares which property/purchase types it applies to (empty = all).

interface BaseSectionDef {
  key: string;
  title: string;
  items: ChecklistItem[];
  propertyTypes?: ChecklistPropertyType[];
  purchaseTypes?: ChecklistPurchaseType[];
}

const BASE_SECTIONS: BaseSectionDef[] = [
  {
    key: "title",
    title: "Title documents",
    items: [
      { title: "Sale deed of the current owner", detail: "The registered deed by which the seller acquired the property." },
      { title: "Chain of title / previous sale deeds", detail: "Trace ownership back at least 30 years — every transfer should be registered and continuous, with no gaps." },
      { title: "Mother deed (parent document)", detail: "The earliest ownership document from which the title flows." },
      { title: "Record of Rights (RoR) — khatiyan / khata / patta", detail: "The land-record entry showing the recorded owner; the seller's name must match." },
    ],
  },
  {
    key: "encumbrance",
    title: "Encumbrance Certificate (EC)",
    items: [
      { title: "Obtain an EC for at least the last 13 years", detail: "30 years is safest. The EC lists every registered transaction (sales, mortgages, liens) and must show the property free of undisclosed charges." },
      { title: "Confirm no existing mortgage or lien on the property" },
    ],
  },
  {
    key: "mutation",
    title: "Mutation / dakhil-kharij",
    items: [
      { title: "Verify mutation is done in the seller's name", detail: "Mutation (dakhil-kharij) updates the land/municipal records to the current owner. Buying un-mutated property risks disputes and blocks your own future mutation." },
      { title: "Latest mutation certificate matching the seller" },
    ],
  },
  {
    key: "tax",
    title: "Property tax receipts",
    items: [
      { title: "Latest property tax receipt, paid up to date", detail: "Unpaid tax becomes the buyer's liability and can hide ownership disputes." },
      { title: "Water / electricity bills cleared" },
    ],
  },
  {
    key: "building",
    title: "Approved building plan & Occupancy Certificate",
    propertyTypes: ["flat", "independent_house", "commercial"],
    items: [
      { title: "Sanctioned / approved building plan from the local authority", detail: "Construction must match the approved plan — unauthorised deviations can be demolished or block a loan." },
      { title: "Completion Certificate (CC)" },
      { title: "Occupancy Certificate (OC)", detail: "Legally required before occupying; its absence is a serious red flag." },
    ],
  },
  {
    key: "rera",
    title: "RERA registration",
    purchaseTypes: ["under_construction"],
    items: [
      { title: "Project is registered with the state RERA", detail: "Verify the RERA registration number on the state RERA portal — check the promoter, approved plan, and delivery timeline." },
      { title: "Check the RERA project page for complaints and status" },
    ],
  },
  {
    key: "landuse",
    title: "Land use / conversion certificate",
    propertyTypes: ["agricultural", "plot"],
    items: [
      { title: "Confirm the land-use classification (agricultural vs non-agricultural / residential)", detail: "Agricultural land usually needs conversion (NA / land-use change) before residential or commercial construction." },
      { title: "Conversion / NA order from the competent authority (if building)" },
    ],
  },
  {
    key: "society",
    title: "Society NOC & dues",
    propertyTypes: ["flat"],
    purchaseTypes: ["resale"],
    items: [
      { title: "No-Objection Certificate (NOC) from the housing society", detail: "Confirms the seller is a member in good standing and the transfer is permitted." },
      { title: "Maintenance dues cleared, in writing", detail: "Outstanding maintenance passes to the buyer." },
      { title: "Share certificate transfer (co-operative societies)" },
    ],
  },
  {
    key: "loan",
    title: "Loan / mortgage clearance",
    items: [
      { title: "If the property was mortgaged, get the original release / no-dues from the bank", detail: "For a home loan being closed at sale, insist on the loan-closure letter and the return of original documents." },
      { title: "Confirm the seller holds the ORIGINAL title documents", detail: "Originals held by a bank usually mean an active loan." },
    ],
  },
];

const BASE_RED_FLAGS: string[] = [
  "Names in the deed chain don't match, or there's a gap in the ownership chain.",
  "Sale via General Power of Attorney (GPA) instead of a registered sale deed.",
  "Price far below the government circle / guideline value.",
  "Seller can't produce the original title documents.",
  "Pending litigation, family partition, or an unmutated inheritance.",
  "Under-construction project with no valid RERA registration.",
];

function applies(def: BaseSectionDef, p: ChecklistPropertyType, u: ChecklistPurchaseType): boolean {
  if (def.propertyTypes && !def.propertyTypes.includes(p)) return false;
  if (def.purchaseTypes && !def.purchaseTypes.includes(u)) return false;
  return true;
}

export interface ChecklistOutput {
  stateName: string;
  stateSlug: string;
  propertyType: ChecklistPropertyType;
  purchaseType: ChecklistPurchaseType;
  propertyTypeLabel: string;
  purchaseTypeLabel: string;
  sections: ChecklistSection[];
  redFlags: string[];
  portals: { label: string; url: string }[];
  hasStateSpecific: boolean;
  disclaimer: string;
  lastUpdated: string;
  sources: string[];
}

/** Assemble the personalised checklist (pure). State-specific section is added
 *  only when the state has verified data. */
export function buildChecklist(
  input: { stateSlug: string; propertyType: ChecklistPropertyType; purchaseType: ChecklistPurchaseType },
  state: StateLegalInfo,
): ChecklistOutput {
  const sections: ChecklistSection[] = BASE_SECTIONS.filter((d) =>
    applies(d, input.propertyType, input.purchaseType),
  ).map((d) => ({ key: d.key, title: d.title, items: d.items }));

  if (state.specific) {
    sections.push({ key: "state", title: state.specific.title, items: state.specific.items });
  }

  return {
    stateName: state.name,
    stateSlug: state.slug,
    propertyType: input.propertyType,
    purchaseType: input.purchaseType,
    propertyTypeLabel: PROPERTY_TYPE_LABELS[input.propertyType],
    purchaseTypeLabel: PURCHASE_TYPE_LABELS[input.purchaseType],
    sections,
    redFlags: [...BASE_RED_FLAGS, ...(state.redFlags ?? [])],
    portals: state.portals,
    hasStateSpecific: Boolean(state.specific),
    disclaimer: CHECKLIST_DISCLAIMER,
    lastUpdated: state.lastUpdated,
    sources: state.sources,
  };
}

// ---- per-state resolver (reuses the Phase-1 state list; same slugs) ----
import { allStampDutyStates } from "@/data/stamp-duty-rates";

interface StateSpecificOverride {
  specific: StateLegalInfo["specific"];
  redFlags?: string[];
  portals: { label: string; url: string }[];
  lastUpdated: string;
  sources: string[];
}

/**
 * Verified state-specific legal additions. Only states with confirmed,
 * source-backed content appear here; every other state falls back to the
 * generic checklist (specific: null, no state section). NEVER invent law.
 */
const STATE_SPECIFIC: Record<string, StateSpecificOverride> = {
  jharkhand: {
    specific: {
      title: "Jharkhand — CNT & SPT Acts (tribal land restrictions)",
      items: [
        {
          title: "Check if the land is protected under the CNT Act (1908) or SPT Act (1949)",
          detail:
            "Land held by tribals/adivasis in Jharkhand has severe transfer restrictions. Check the record-of-rights (khatian) classification on JharBhoomi before anything else.",
        },
        {
          title: "Confirm whether the seller is a Scheduled Tribe (adivasi)",
          detail:
            "Tribal-held land generally cannot be sold to a non-tribal without the Deputy Commissioner's (DC) permission; in the Santhal Pargana area it is effectively barred.",
        },
        {
          title: "If DC permission is required, confirm it has actually been granted",
          detail:
            "Under the CNT Act a transfer beyond the same tribe/village needs the Deputy Commissioner's sanction (except for industry/mining under the 1996 amendment).",
        },
        {
          title: "In Santhal Pargana, confirm the 'right to transfer' is recorded in the record-of-rights",
          detail:
            "The SPT Act (1949) makes a transfer invalid unless this right is recorded. Santhal Pargana division = Dumka, Deoghar, Godda, Pakur, Sahibganj and Jamtara.",
        },
        { title: "Verify khatian, khesra and mutation status on JharBhoomi" },
      ],
    },
    redFlags: [
      "Tribal/adivasi land in Jharkhand sold without Deputy Commissioner permission — the sale can be void.",
      "Land in a Santhal Pargana district (Dumka, Deoghar, Godda, Pakur, Sahibganj, Jamtara) without the right-to-transfer recorded in the RoR.",
    ],
    portals: [
      { label: "JharBhoomi (land records)", url: "https://jharbhoomi.jharkhand.gov.in/" },
      { label: "JharERA (RERA Jharkhand)", url: "https://jharera.jharkhand.gov.in/" },
    ],
    lastUpdated: "2026-01-01",
    sources: [
      "https://www.indiacode.nic.in/bitstream/123456789/7796/1/the_chota_nagpur_tenancy_act,1908.pdf",
      "https://www.indiacode.nic.in/bitstream/123456789/8120/1/santhal_parganas_tenancy_laws_full.pdf",
    ],
  },

  bihar: {
    specific: {
      title: "Bihar — mutation & Jamabandi verification",
      items: [
        {
          title: "Confirm the seller's name in the current Jamabandi",
          detail: "The Jamabandi (record of rights) should show the seller as the recorded owner — verify on Bihar Bhumi.",
        },
        {
          title: "Check that mutation (dakhil-kharij) is up to date",
          detail:
            "Under the Bihar Land Mutation Act 2011, the Circle Officer processes mutation after registration. Track it on the Parimarjan portal; dakhil-kharij is a free government service.",
        },
        { title: "Inspect the registered deed and encumbrance history on Bhumi Jankari" },
        { title: "Verify the Khesra, Khatian and Register-II entries" },
      ],
    },
    redFlags: ["Land not mutated, or the seller is not the recorded owner in the current Jamabandi."],
    portals: [
      { label: "Bihar Bhumi (mutation / Jamabandi)", url: "https://biharbhumi.bihar.gov.in/" },
      { label: "Bhumi Jankari (deed / EC records)", url: "https://bhumijankari.bihar.gov.in/" },
      { label: "Parimarjan (mutation status)", url: "https://parimarjanplus.bihar.gov.in/" },
    ],
    lastUpdated: "2026-01-01",
    sources: ["https://www.indiacode.nic.in/handle/123456789/7859?view_type=browse"],
  },

  maharashtra: {
    specific: {
      title: "Maharashtra — 7/12 extract & MahaRERA",
      items: [
        {
          title: "Get a digitally-signed 7/12 extract (Satbara) or Property Card",
          detail:
            "The free Mahabhulekh view is not enough for legal use — obtain the digitally-signed 7/12 from digitalsatbara.mahabhumi.gov.in.",
        },
        { title: "Check the owner and any 'other rights' (loans/charges) recorded on the 7/12" },
        { title: "For any project, verify MahaRERA registration and status" },
      ],
    },
    portals: [
      { label: "Mahabhulekh (7/12 land records)", url: "https://bhulekh.mahabhumi.gov.in/" },
      { label: "Digitally-signed 7/12", url: "https://digitalsatbara.mahabhumi.gov.in/" },
      { label: "MahaRERA", url: "https://maharera.maharashtra.gov.in/" },
    ],
    lastUpdated: "2026-01-01",
    sources: ["https://bhulekh.mahabhumi.gov.in/", "https://maharera.maharashtra.gov.in/"],
  },

  "tamil-nadu": {
    specific: {
      title: "Tamil Nadu — Patta / Chitta",
      items: [
        { title: "Verify the Patta and Chitta (ownership & land classification) on the TN e-Services portal" },
        { title: "Confirm the land classification (Nanjai/wet vs Punjai/dry) matches the intended use" },
        { title: "For projects, verify TNRERA registration" },
      ],
    },
    portals: [
      { label: "TN e-Services (Patta/Chitta)", url: "https://eservices.tn.gov.in/" },
      { label: "TNRERA", url: "https://rera.tn.gov.in/" },
    ],
    lastUpdated: "2026-01-01",
    sources: ["https://eservices.tn.gov.in/", "https://rera.tn.gov.in/"],
  },

  "west-bengal": {
    specific: {
      title: "West Bengal — Banglarbhumi & RERA",
      items: [
        { title: "Verify the Khatian / Porcha (record of rights) on Banglarbhumi" },
        {
          title: "For under-construction projects, verify registration with WBRERA — not the old WB-HIRA",
          detail:
            "WB-HIRA was struck down by the Supreme Court in 2021; West Bengal now operates under the central RERA (WBRERA).",
        },
      ],
    },
    portals: [
      { label: "Banglarbhumi (land records)", url: "https://banglarbhumi.gov.in/" },
      { label: "WBRERA", url: "https://rera.wb.gov.in/" },
    ],
    lastUpdated: "2026-01-01",
    sources: ["https://banglarbhumi.gov.in/", "https://rera.wb.gov.in/"],
  },
};

export function getLegalState(slug: string): StateLegalInfo | null {
  const base = allStampDutyStates().find((s) => s.slug === slug);
  if (!base) return null;
  const o = STATE_SPECIFIC[slug];
  return {
    slug: base.slug,
    name: base.name,
    specific: o?.specific ?? null,
    redFlags: o?.redFlags,
    portals: o?.portals ?? [],
    lastUpdated: o?.lastUpdated ?? "2026-01-01",
    sources: o?.sources ?? [],
  };
}

export function allLegalStates(): StateLegalInfo[] {
  return allStampDutyStates().map((s) => getLegalState(s.slug)!);
}

export function hasVerifiedStateLegal(slug: string): boolean {
  return Boolean(STATE_SPECIFIC[slug]?.specific);
}
