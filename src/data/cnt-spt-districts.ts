/**
 * Jharkhand CNT / SPT land-restriction data (lead-magnet TOOL 1).
 *
 * ⚠️ LEGAL CONTENT — every fact here is verified against official / authoritative
 * sources (see SOURCES). Nothing is invented. The verdicts are deliberately
 * CONSERVATIVE: for CNT/SPT land there is no clean "allowed" without checking the
 * plot's record, so we only ever say RESTRICTED or NOT ALLOWED and always tell
 * the buyer to verify the khatiyan at the Circle Office. This is general
 * information, not legal advice.
 *
 * Division → Act mapping (all 24 districts classified, none unverified):
 *   - CNT Act 1908 (Chotanagpur Tenancy Act): North Chotanagpur, South
 *     Chotanagpur, Palamu and Kolhan divisions (18 districts).
 *   - SPT Act 1949 (Santhal Parganas Tenancy (Supplementary Provisions) Act):
 *     Santhal Pargana division (6 districts).
 * Sources: Administrative divisions of Jharkhand (division→district); India Code
 * CNT Act 1908 text; Indian Kanoon CNT/SPT; Judicial Academy Jharkhand land-law
 * handbook. See SOURCES below.
 */

export type CntSptAct = "CNT" | "SPT";
export type CntBuyerType = "tribal" | "non_tribal" | "sc" | "obc" | "company_trust";
export type CntLandType = "agricultural" | "residential" | "commercial";
/** No clean "allowed" for CNT/SPT land — the plot's record decides it. */
export type CntVerdict = "restricted" | "not_allowed";

export const BUYER_TYPE_LABELS: Record<CntBuyerType, string> = {
  tribal: "Tribal (Scheduled Tribe)",
  non_tribal: "Non-tribal",
  sc: "Scheduled Caste (SC)",
  obc: "OBC / Backward Class",
  company_trust: "Company / Trust",
};

export const LAND_TYPE_LABELS: Record<CntLandType, string> = {
  agricultural: "Agricultural",
  residential: "Residential",
  commercial: "Commercial",
};

export const CNT_SPT_DISCLAIMER =
  "This is general information, not legal advice. Land laws change and vary by district and by the specific plot's record. Check with the local Circle Office (Anchal) or a property lawyer before you buy or pay any money.";

// Official / authoritative sources (shown on-page + used for verification).
const SOURCES: string[] = [
  "https://www.indiacode.nic.in/bitstream/123456789/7796/1/the_chota_nagpur_tenancy_act,1908.pdf",
  "https://indiankanoon.org/doc/3607906/",
  "https://indiankanoon.org/doc/191077268/",
  "https://en.wikipedia.org/wiki/Administrative_divisions_of_Jharkhand",
  "https://jajharkhand.in/wp/wp-content/uploads/2019/08/06_handbook_on_land_law.pdf",
];

const ACT_META: Record<CntSptAct, { name: string; section: string }> = {
  CNT: { name: "Chotanagpur Tenancy Act, 1908 (CNT)", section: "Section 46" },
  SPT: {
    name: "Santhal Parganas Tenancy (Supplementary Provisions) Act, 1949 (SPT)",
    section: "Section 20",
  },
};

/**
 * Kolhan Government Estate flag (distinct from the Kolhan administrative
 * division). CNT Act Section 46(3) requires the Deputy Commissioner's previous
 * sanction for EVERY transfer by a raiyat of the Kolhan — non-tribal to
 * non-tribal included. It applies to the Kolhan Government Estate (Chaibasa
 * Sadar subdivision in West Singhbhum + the Seraikela areas), not to a whole
 * district. So West Singhbhum / Seraikela-Kharsawan carry it ("full"), while
 * East Singhbhum only partly overlaps it ("partial").
 */
type KolhanEstate = "full" | "partial";

interface DistrictRow {
  name: string;
  division: string;
  act: CntSptAct;
  kolhanEstate?: KolhanEstate;
}

/** All 24 Jharkhand districts, by slug. Slugs are kebab-case district names. */
const DISTRICTS: Record<string, DistrictRow> = {
  // ---- CNT Act (Chotanagpur + Palamu + Kolhan) — 18 districts ----
  // North Chotanagpur
  bokaro: { name: "Bokaro", division: "North Chotanagpur", act: "CNT" },
  chatra: { name: "Chatra", division: "North Chotanagpur", act: "CNT" },
  dhanbad: { name: "Dhanbad", division: "North Chotanagpur", act: "CNT" },
  giridih: { name: "Giridih", division: "North Chotanagpur", act: "CNT" },
  hazaribagh: { name: "Hazaribagh", division: "North Chotanagpur", act: "CNT" },
  koderma: { name: "Koderma", division: "North Chotanagpur", act: "CNT" },
  ramgarh: { name: "Ramgarh", division: "North Chotanagpur", act: "CNT" },
  // South Chotanagpur
  gumla: { name: "Gumla", division: "South Chotanagpur", act: "CNT" },
  khunti: { name: "Khunti", division: "South Chotanagpur", act: "CNT" },
  lohardaga: { name: "Lohardaga", division: "South Chotanagpur", act: "CNT" },
  ranchi: { name: "Ranchi", division: "South Chotanagpur", act: "CNT" },
  simdega: { name: "Simdega", division: "South Chotanagpur", act: "CNT" },
  // Palamu
  garhwa: { name: "Garhwa", division: "Palamu", act: "CNT" },
  latehar: { name: "Latehar", division: "Palamu", act: "CNT" },
  palamu: { name: "Palamu", division: "Palamu", act: "CNT" },
  // Kolhan (division). Kolhan Government Estate (Sec 46(3)): West Singhbhum +
  // Seraikela fully carry it; East Singhbhum only partly overlaps.
  "east-singhbhum": { name: "East Singhbhum", division: "Kolhan", act: "CNT", kolhanEstate: "partial" },
  "west-singhbhum": { name: "West Singhbhum", division: "Kolhan", act: "CNT", kolhanEstate: "full" },
  "seraikela-kharsawan": {
    name: "Seraikela-Kharsawan",
    division: "Kolhan",
    act: "CNT",
    kolhanEstate: "full",
  },
  // ---- SPT Act (Santhal Pargana) — 6 districts ----
  deoghar: { name: "Deoghar", division: "Santhal Pargana", act: "SPT" },
  dumka: { name: "Dumka", division: "Santhal Pargana", act: "SPT" },
  godda: { name: "Godda", division: "Santhal Pargana", act: "SPT" },
  jamtara: { name: "Jamtara", division: "Santhal Pargana", act: "SPT" },
  pakur: { name: "Pakur", division: "Santhal Pargana", act: "SPT" },
  sahibganj: { name: "Sahibganj", division: "Santhal Pargana", act: "SPT" },
};

export interface CntSptDistrict {
  slug: string;
  name: string;
  division: string;
  act: CntSptAct;
  kolhanEstate?: KolhanEstate;
}

export function allCntSptDistricts(): CntSptDistrict[] {
  return Object.entries(DISTRICTS)
    .map(([slug, d]) => ({ slug, name: d.name, division: d.division, act: d.act, kolhanEstate: d.kolhanEstate }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCntSptDistrict(slug: string): CntSptDistrict | null {
  const d = DISTRICTS[slug];
  return d
    ? { slug, name: d.name, division: d.division, act: d.act, kolhanEstate: d.kolhanEstate }
    : null;
}

/** The Kolhan Government Estate special rule (CNT Section 46(3)), or null. */
export interface KolhanRule {
  level: KolhanEstate;
  heading: string;
  text: string;
  quote: string;
  section: string;
}

function kolhanRuleFor(estate: KolhanEstate | undefined): KolhanRule | null {
  if (!estate) return null;
  const quote =
    "No transfer by a raiyat of the Kolhan in the district of Singhbhum shall be made without the previous sanction of the Deputy Commissioner, whose order shall be final.";
  const section = "CNT Act, 1908 — Section 46(3)";
  if (estate === "full") {
    return {
      level: "full",
      heading: "Kolhan special rule — DC sanction for EVERY transfer",
      text: "This area is part of the Kolhan Government Estate. Here EVERY transfer of raiyat land needs the Deputy Commissioner's previous sanction — a non-tribal-to-non-tribal sale included. This is stricter than other CNT districts; without the DC's sanction the transfer is not valid.",
      quote,
      section,
    };
  }
  return {
    level: "partial",
    heading: "Kolhan estate may apply — check the plot",
    text: "Parts of this district fall under the Kolhan Government Estate, where every transfer of raiyat land needs the Deputy Commissioner's previous sanction (non-tribal to non-tribal included). Confirm the specific plot's status at the Circle Office before you proceed.",
    quote,
    section,
  };
}

// ---- Verdict rules (verified, conservative) ---------------------------------

interface Verdict {
  verdict: CntVerdict;
  summary: string;
  permission: string;
}

/** Verdict for (act, buyer). Both acts protect tribal/SC/BC land; SPT is stricter. */
function verdictFor(act: CntSptAct, buyer: CntBuyerType): Verdict {
  const { section } = ACT_META[act];
  if (act === "SPT") {
    switch (buyer) {
      case "non_tribal":
        return {
          verdict: "not_allowed",
          summary:
            "In Santhal Pargana, tenant (raiyati) land is largely non-transferable — a sale to a non-tribal is generally not valid.",
          permission: `Not permitted for raiyati land (SPT Act, ${section}). There is no ordinary route to buy such land as a non-tribal.`,
        };
      case "tribal":
        return {
          verdict: "restricted",
          summary:
            "Even tribal-to-tribal transfer in Santhal Pargana is tightly restricted — it is valid only where the right to transfer is recorded in the record-of-rights.",
          permission: `Valid only if the record-of-rights records a transfer right; narrow exceptions (e.g. certain gifts) need the Deputy Commissioner's written permission (SPT Act, ${section}).`,
        };
      case "sc":
      case "obc":
        return {
          verdict: "restricted",
          summary:
            "Raiyati land in Santhal Pargana is heavily protected — most transfers to outsiders are not permitted.",
          permission: `Check the plot's record-of-rights and the Circle Office; transfers generally need to be a recorded right (SPT Act, ${section}).`,
        };
      case "company_trust":
        return {
          verdict: "not_allowed",
          summary:
            "A company or trust generally cannot acquire Santhal Pargana raiyati land.",
          permission: `Not permitted through the ordinary route (SPT Act, ${section}).`,
        };
    }
  }
  // CNT
  switch (buyer) {
    case "non_tribal":
      return {
        verdict: "not_allowed",
        summary:
          "Land recorded as tribal (ST) land generally cannot be sold to a non-tribal under the CNT Act.",
        permission: `A tribal → non-tribal transfer of raiyati land is barred (CNT Act, ${section}); narrow industrial/mining/public-purpose routes need the Deputy Commissioner's / State Government's permission (1996 amendment). Verify the plot's record first.`,
      };
    case "tribal":
      return {
        verdict: "restricted",
        summary:
          "A Scheduled-Tribe buyer can generally acquire tribal land only within the same police-station area, with permission.",
        permission: `Needs the Deputy Commissioner's (DC) written permission, and the buyer must usually belong to the same police-station area (CNT Act, ${section}).`,
      };
    case "sc":
      return {
        verdict: "restricted",
        summary:
          "SC-recorded land can generally be transferred only to another SC person of the same district.",
        permission: `Needs the Deputy Commissioner's (DC) written permission, buyer of the same SC category and district (CNT Act, ${section}).`,
      };
    case "obc":
      return {
        verdict: "restricted",
        summary:
          "Backward-class (BC) recorded land is restricted — generally kept within the district.",
        permission: `Needs the Deputy Commissioner's (DC) written permission and (generally) a buyer from the same district (CNT Act, ${section}).`,
      };
    case "company_trust":
      return {
        verdict: "not_allowed",
        summary:
          "A company or trust generally cannot acquire tribal (CNT) land.",
        permission: `Only narrow industrial / mining / public-purpose acquisitions are possible, with the Deputy Commissioner's / State Government's permission (CNT Act, 1996 amendment).`,
      };
  }
}

function documentsFor(buyer: CntBuyerType): string[] {
  const base = [
    "Khatiyan / record-of-rights (record showing the plot's tenure and category)",
    "Latest revenue map (naksha) and plot (khesra) details",
    "Full chain of title / previous registered deeds",
    "Up-to-date land-rent receipt (rasid)",
    "Seller's and buyer's ID proof",
  ];
  if (buyer === "tribal") base.push("Caste (Scheduled Tribe) certificate of the buyer");
  if (buyer === "sc") base.push("Caste (Scheduled Caste) certificate of the buyer");
  if (buyer === "obc") base.push("Backward-class certificate of the buyer");
  base.push("Deputy Commissioner (DC) written permission order, where the transfer needs it");
  return base;
}

export interface CntSptInput {
  districtSlug: string;
  buyerType: CntBuyerType;
  landType: CntLandType;
}

export interface CntSptOutput {
  districtName: string;
  districtSlug: string;
  division: string;
  act: CntSptAct;
  actName: string;
  buyerLabel: string;
  landLabel: string;
  verdict: CntVerdict;
  verdictLabel: string;
  summary: string;
  permission: string;
  /** Kolhan Government Estate special rule (Sec 46(3)) — null outside Kolhan. */
  kolhanRule: KolhanRule | null;
  documents: string[];
  timeline: string;
  conversion: string;
  homeLoanWarning: string;
  caveat: string;
  sources: string[];
  disclaimer: string;
  lastUpdated: string;
}

const LAST_UPDATED = "2026-09-09";

/** Build the authoritative CNT/SPT answer (pure). */
export function buildCntSpt(input: CntSptInput, district: CntSptDistrict): CntSptOutput {
  const v = verdictFor(district.act, input.buyerType);
  return {
    districtName: district.name,
    districtSlug: district.slug,
    division: district.division,
    act: district.act,
    actName: ACT_META[district.act].name,
    buyerLabel: BUYER_TYPE_LABELS[input.buyerType],
    landLabel: LAND_TYPE_LABELS[input.landType],
    verdict: v.verdict,
    verdictLabel: v.verdict === "not_allowed" ? "Not allowed" : "Restricted",
    summary: v.summary,
    permission: v.permission,
    kolhanRule: kolhanRuleFor(district.kolhanEstate),
    documents: documentsFor(input.buyerType),
    timeline:
      "There is no fixed, guaranteed timeline for a DC-permission case — it commonly takes several months and depends on the Circle Office and the DC's office. Confirm locally before you plan around a date.",
    conversion:
      input.landType === "agricultural"
        ? "Changing the use of CNT/SPT agricultural land (for example to residential or commercial) is tightly restricted and rarely permitted. It needs the Deputy Commissioner's permission — check with the Circle Office first."
        : "Any change of the recorded land use under CNT/SPT needs the Deputy Commissioner's permission and is not routine. Check with the Circle Office.",
    homeLoanWarning:
      "Most banks do NOT give a home loan against CNT/SPT land, because it cannot be freely sold or mortgaged and so makes weak collateral. Confirm with your bank before you pay any money.",
    caveat:
      "This answer assumes the plot may be recorded as tribal / SC / BC (protected) land — the exact result depends on the plot's own record-of-rights (khatiyan). Always verify the specific plot at the Circle Office (Anchal) before you decide.",
    sources: SOURCES,
    disclaimer: CNT_SPT_DISCLAIMER,
    lastUpdated: LAST_UPDATED,
  };
}
