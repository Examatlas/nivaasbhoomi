import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allLegalStates } from "@/data/legal-checklist";
import { PropertyChecklistTool } from "@/components/tools/property-checklist-tool";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: `Property Legal Checklist — Documents to Verify Before Buying | ${BRAND}` },
  description:
    "Free state-wise property legal due-diligence checklist for India: title deeds, encumbrance certificate, mutation, RERA and state-specific rules. Print or save as PDF.",
  alternates: { canonical: absoluteUrl("/tools/property-checklist") },
};

const FAQS = [
  {
    question: "What documents should I verify before buying property?",
    answer:
      "At minimum: the sale deed and full chain of title, the Encumbrance Certificate (13–30 years), mutation/dakhil-kharij in the seller's name, up-to-date property tax receipts, and — for flats/houses — the approved building plan and Occupancy Certificate. Under-construction projects must have a valid RERA registration.",
  },
  {
    question: "How many years of Encumbrance Certificate should I get?",
    answer:
      "Get an EC for at least the last 13 years; 30 years is safest. It lists every registered transaction on the property, so any hidden mortgage, lien or double-sale shows up.",
  },
  {
    question: "What is mutation (dakhil-kharij) and why does it matter?",
    answer:
      "Mutation updates the government land/municipal records to show the current owner. If the seller's name isn't mutated, ownership is unclear and it will block your own mutation after purchase.",
  },
  {
    question: "Is this checklist legal advice?",
    answer:
      "No. It is a general due-diligence checklist. Property law varies by state and situation — always consult a qualified property lawyer before buying.",
  },
];

export default function ChecklistIndexPage() {
  const states = allLegalStates();
  const withRules = states.filter((s) => s.specific);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "Property legal checklist", url: "/tools/property-checklist" },
          ]),
          ...(faqPageJsonLd(FAQS) ? [faqPageJsonLd(FAQS)!] : []),
        ]}
      />
      <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/tools" className="hover:text-foreground">Tools</Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">Property legal checklist</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Property legal checklist</h1>
          <p className="mt-2 text-muted-foreground">
            Don&apos;t buy on trust. Get a printable, state-specific checklist of every document to
            demand and red flag to watch — before you pay a rupee.
          </p>
        </header>

        <PropertyChecklistTool />

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink-950">Checklist by state</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {withRules.length > 0
              ? `${withRules.length} state(s) include verified state-specific rules (like Jharkhand's CNT/SPT tribal-land restrictions).`
              : "Open your state for its checklist."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {states.map((s) => (
              <Link
                key={s.slug}
                href={`/tools/property-checklist/${s.slug}`}
                className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50"
              >
                {s.name}
                {s.specific && <span className="ml-1 text-meta text-clay-700">★</span>}
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-8 rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-meta text-warning-700">
          This is a general checklist, not legal advice. Before buying any property, consult a
          qualified property lawyer.
        </p>
      </div>
    </>
  );
}
