import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allLegalStates, getLegalState, type StateLegalInfo } from "@/data/legal-checklist";
import { PropertyChecklistTool } from "@/components/tools/property-checklist-tool";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return allLegalStates().map((s) => ({ state: s.slug }));
}

function stateFaqs(s: StateLegalInfo): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [
    {
      question: `What documents should I check before buying property in ${s.name}?`,
      answer: `Verify the sale deed and full chain of title, an Encumbrance Certificate (13–30 years), mutation (dakhil-kharij) in the seller's name, property tax receipts, and — for flats/houses — the approved plan and Occupancy Certificate. Under-construction projects need a valid RERA registration.`,
    },
    {
      question: `How many years of Encumbrance Certificate should I get in ${s.name}?`,
      answer: `Get an EC covering at least the last 13 years (30 years is safest) so any hidden mortgage, lien or double sale on the property is visible.`,
    },
  ];
  if (s.specific) {
    faqs.unshift({
      question: `${s.specific.title} — what should a buyer check in ${s.name}?`,
      answer: s.specific.items.map((i) => i.title + (i.detail ? `: ${i.detail}` : "")).join(" "),
    });
  }
  return faqs;
}

export async function generateMetadata(
  { params }: PageProps<"/tools/property-checklist/[state]">,
): Promise<Metadata> {
  const { state } = await params;
  const s = getLegalState(state);
  if (!s) return {};
  return {
    title: { absolute: `${s.name} Property Legal Checklist — Documents to Verify | ${BRAND}` },
    description: s.specific
      ? `${s.name} property buying checklist including ${s.specific.title.toLowerCase()}, title, EC, mutation and RERA checks. Print or save as PDF.`
      : `${s.name} property legal checklist: title deeds, encumbrance certificate, mutation, RERA and more. Print or save as PDF.`,
    alternates: { canonical: absoluteUrl(`/tools/property-checklist/${s.slug}`) },
  };
}

export default async function ChecklistStatePage({ params }: PageProps<"/tools/property-checklist/[state]">) {
  const { state: slug } = await params;
  const s = getLegalState(slug);
  if (!s) notFound();

  const faqs = stateFaqs(s);
  const faqLd = faqPageJsonLd(faqs);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "Property legal checklist", url: "/tools/property-checklist" },
            { name: s.name, url: `/tools/property-checklist/${s.slug}` },
          ]),
          ...(faqLd ? [faqLd] : []),
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
          <Link href="/tools/property-checklist" className="hover:text-foreground">Legal checklist</Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{s.name}</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">{s.name} property legal checklist</h1>
          <p className="mt-2 text-muted-foreground">
            {s.specific
              ? `Everything to verify before buying in ${s.name} — including ${s.specific.title.toLowerCase()}, the part most buyers miss.`
              : `Every document to demand and red flag to watch before buying property in ${s.name}.`}
          </p>
        </header>

        <PropertyChecklistTool initialStateSlug={s.slug} />

        <section className="mt-12 max-w-2xl">
          <h2 className="text-lg font-semibold text-ink-950">{s.name} — frequently asked</h2>
          <dl className="mt-4 flex flex-col divide-y divide-border">
            {faqs.map((f) => (
              <div key={f.question} className="py-4">
                <dt className="font-medium text-ink-950">{f.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-8 rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-meta text-warning-700">
          This is a general checklist, not legal advice. Before buying any property, consult a
          qualified property lawyer.
          {s.sources.length > 0 && (
            <>
              {" "}Sources:{" "}
              {s.sources.map((u, i) => (
                <span key={u}>
                  {i > 0 ? ", " : ""}
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline">official</a>
                </span>
              ))}
              . Last reviewed {s.lastUpdated}.
            </>
          )}
        </p>
      </div>
    </>
  );
}
