/**
 * Mutation / Dakhil-Kharij guide data (lead-magnet TOOL 2).
 *
 * ⚠️ LEGAL/PROCESS CONTENT — verified against the official state land portals.
 * Only Bihar, Jharkhand and UP (our core market) carry a full, verified process;
 * every other state is marked "coming soon" rather than guessed. Nothing invented.
 *
 * State slugs reuse the stamp-duty state list so params/sitemap stay consistent.
 */
import { allStampDutyStates } from "@/data/stamp-duty-rates";

export type MutationPropertyType = "agricultural" | "residential" | "commercial";
export type MutationTransferType = "sale" | "inheritance" | "gift" | "partition";

export const MUTATION_PROPERTY_LABELS: Record<MutationPropertyType, string> = {
  agricultural: "Agricultural",
  residential: "Residential",
  commercial: "Commercial",
};
export const MUTATION_TRANSFER_LABELS: Record<MutationTransferType, string> = {
  sale: "Sale / purchase",
  inheritance: "Inheritance",
  gift: "Gift",
  partition: "Partition",
};

export const MUTATION_DISCLAIMER =
  "This is general information, not legal advice. Portals, fees and timelines change and vary by district. Check with the local Circle Office / Tehsil or a property lawyer before you act or pay any money.";

interface StateMutation {
  name: string;
  verified: boolean; // false → "coming soon"
  online: boolean;
  portal: { name: string; url: string } | null; // where you apply
  records?: { name: string; url: string }; // where you view land records
  steps: string[];
  fees: string;
  timeline: string;
  statusTracking: string;
  appeal: string;
  commonMistakes: string[];
  /** Extra note (e.g. Jharkhand CNT/SPT). */
  note?: string;
  sources: string[];
}

const LAST_UPDATED = "2026-09-09";

// Verified states (core market). Keys must match the stamp-duty state slugs.
const STATE_MUTATION: Record<string, StateMutation> = {
  bihar: {
    name: "Bihar",
    verified: true,
    online: true,
    portal: { name: "Bihar Bhumi — Online Dakhil Kharij", url: "https://biharbhumi.bihar.gov.in/" },
    records: { name: "Bihar Bhumi (records / jamabandi)", url: "https://biharbhumi.bihar.gov.in/" },
    steps: [
      "Go to biharbhumi.bihar.gov.in and open “Online Dakhil Kharij Aavedan”. Register / log in first.",
      "Fill your (buyer) details and the property details — district, circle (anchal), mauza, khata and khesra numbers.",
      "Enter the previous owner details and upload the documents (deed, previous record, etc.).",
      "Submit and note the case / application number.",
      "The Circle Officer (CO) reviews it; there is an objection window for anyone to raise a dispute.",
      "If everything is in order, the CO passes the mutation order and the jamabandi is updated in your name.",
    ],
    fees:
      "Applying online through the Bihar Bhumi portal is free (no government fee for the application itself).",
    timeline:
      "There is no single guaranteed timeline; in practice it commonly takes a few weeks and varies by Circle Office workload.",
    statusTracking:
      "Track on the portal by Application/Case number, registered Deed number, or Khesra (plot) number. Helpline: 1800-345-6215.",
    appeal:
      "If the CO rejects it, appeal to the DCLR (Deputy Collector, Land Reforms) court with the CO's rejection order and the corrected documents.",
    commonMistakes: [
      "Wrong khata / khesra number, or a mismatch between the deed and the record.",
      "Gaps in the previous-owner chain (an earlier sale never mutated).",
      "Unpaid land rent, or an unclear / disputed title that draws an objection.",
    ],
    sources: ["https://biharbhumi.bihar.gov.in/"],
  },
  jharkhand: {
    name: "Jharkhand",
    verified: true,
    online: true,
    portal: {
      name: "JharBhoomi — Online Mutation",
      url: "https://jharbhoomi.jharkhand.gov.in/",
    },
    records: { name: "JharBhoomi (records)", url: "https://jharbhoomi.jharkhand.gov.in/" },
    steps: [
      "Go to jharbhoomi.jharkhand.gov.in, open “Online Application” and register / log in.",
      "Select your District and Anchal (Circle).",
      "Choose “Apply New Mutation” (Dakhil Kharij) and fill your details and the plot details.",
      "Enter the previous owner and upload the registered deed and supporting documents.",
      "Submit and note the case number.",
      "The Circle Officer reviews it (with an objection window) and passes the mutation order; the record is updated.",
    ],
    fees: "Applying online through JharBhoomi is free (no government fee for the application).",
    timeline:
      "No fixed statutory guarantee; commonly a few weeks, and it varies by Circle Office. (JharBhoomi is being upgraded/linked with NGDRS, so after a registration the mutation may start automatically.)",
    statusTracking:
      "Track on JharBhoomi by Case No., Applicant Name, Mauja or Date.",
    appeal:
      "If it is rejected, appeal to the DCLR (Deputy Collector, Land Reforms) court with the rejection order and corrected papers.",
    commonMistakes: [
      "Wrong plot / khata details or a deed-vs-record mismatch.",
      "Missing land-rent receipt or an incomplete title chain.",
      "Applying for CNT/SPT tribal land without the required transfer permission (see the note below).",
    ],
    note:
      "In Jharkhand, if the land is CNT or SPT (tribal) land, the transfer itself is restricted and mutation can be blocked without the Deputy Commissioner's permission. Check the CNT/SPT land checker first.",
    sources: ["https://jharbhoomi.jharkhand.gov.in/"],
  },
  "uttar-pradesh": {
    name: "Uttar Pradesh",
    verified: true,
    online: true,
    portal: { name: "RCCMS UP (Vaad) — mutation application", url: "https://vaad.up.nic.in/" },
    records: { name: "UP Bhulekh (khatauni / records)", url: "https://upbhulekh.gov.in/" },
    steps: [
      "After a registered sale, mutation (namantaran / dakhil-kharij) is often started from the registration itself; you can also apply online at vaad.up.nic.in.",
      "The Lekhpal (village revenue officer) does a field verification — a site visit, checking boundaries with neighbours and the seller's claim.",
      "There is an objection window for disputes.",
      "The Tehsildar passes the mutation order (UP Revenue Code, Section 34).",
      "The khatauni (record) is updated in your name.",
    ],
    fees:
      "The fee varies by tehsil and by the type of transfer — confirm the current fee at the tehsil or on the portal before applying.",
    timeline:
      "No fixed guarantee; commonly around 30–45 days when the papers are complete, and it varies by tehsil.",
    statusTracking: "Track by the application number on vaad.up.nic.in; view records on upbhulekh.gov.in.",
    appeal:
      "If it is rejected or objected, it goes to the revenue court (SDM / appellate authority); RCCMS (vaad.up.nic.in) tracks revenue cases.",
    commonMistakes: [
      "Name / spelling mismatch between the deed and the record.",
      "For inheritance, missing the legal-heir (varasat) certificate.",
      "A boundary dispute raised at the Lekhpal's field verification, or an incomplete khatauni.",
    ],
    sources: ["https://vaad.up.nic.in/", "https://upbhulekh.gov.in/"],
  },
};

export interface MutationStateInfo {
  slug: string;
  name: string;
  verified: boolean;
}

/** Every state slug (from the shared stamp-duty list), marked verified or not. */
export function allMutationStates(): MutationStateInfo[] {
  return allStampDutyStates().map((s) => ({
    slug: s.slug,
    name: s.name,
    verified: Boolean(STATE_MUTATION[s.slug]?.verified),
  }));
}

export function getMutationState(slug: string): MutationStateInfo | null {
  const found = allStampDutyStates().find((s) => s.slug === slug);
  if (!found) return null;
  return { slug: found.slug, name: found.name, verified: Boolean(STATE_MUTATION[slug]?.verified) };
}

function documentsFor(transfer: MutationTransferType): string[] {
  const deed =
    transfer === "sale"
      ? "Registered sale deed"
      : transfer === "gift"
        ? "Registered gift deed"
        : transfer === "partition"
          ? "Registered partition deed / family settlement"
          : "Proof of inheritance (registered will, if any)";
  const docs = [
    deed,
    "Previous record of rights (jamabandi / khatiyan / khatauni) in the seller's or ancestor's name",
    "Latest land-rent / property-tax receipt",
    "ID proof of the applicant",
    "The mutation application form",
  ];
  if (transfer === "inheritance") {
    docs.splice(1, 0, "Death certificate of the previous owner", "Legal-heir / succession certificate");
  }
  return docs;
}

export interface MutationInput {
  stateSlug: string;
  propertyType: MutationPropertyType;
  transferType: MutationTransferType;
}

export interface MutationOutput {
  stateName: string;
  stateSlug: string;
  verified: boolean;
  online: boolean;
  propertyLabel: string;
  transferLabel: string;
  portal: { name: string; url: string } | null;
  records: { name: string; url: string } | null;
  steps: string[];
  documents: string[];
  fees: string;
  timeline: string;
  statusTracking: string;
  appeal: string;
  commonMistakes: string[];
  note: string | null;
  sources: string[];
  disclaimer: string;
  lastUpdated: string;
}

/** Build the mutation guide (pure). Unverified states → a "coming soon" shell. */
export function buildMutation(input: MutationInput, state: MutationStateInfo): MutationOutput {
  const data = STATE_MUTATION[input.stateSlug];
  const base = {
    stateName: state.name,
    stateSlug: state.slug,
    verified: Boolean(data?.verified),
    propertyLabel: MUTATION_PROPERTY_LABELS[input.propertyType],
    transferLabel: MUTATION_TRANSFER_LABELS[input.transferType],
    disclaimer: MUTATION_DISCLAIMER,
    lastUpdated: LAST_UPDATED,
  };
  if (!data?.verified) {
    return {
      ...base,
      online: false,
      portal: null,
      records: null,
      steps: [],
      documents: documentsFor(input.transferType),
      fees: "",
      timeline: "",
      statusTracking: "",
      appeal: "",
      commonMistakes: [],
      note: `A verified step-by-step guide for ${state.name} is coming soon. For now, apply through your state's official land-records portal or your local Tehsil / Circle Office. The document list below applies generally.`,
      sources: [],
    };
  }
  return {
    ...base,
    online: data.online,
    portal: data.portal,
    records: data.records ?? null,
    steps: data.steps,
    documents: documentsFor(input.transferType),
    fees: data.fees,
    timeline: data.timeline,
    statusTracking: data.statusTracking,
    appeal: data.appeal,
    commonMistakes: data.commonMistakes,
    note: data.note ?? null,
    sources: data.sources,
  };
}
