import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd, howToJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import {
  allMutationStates,
  getMutationState,
  buildMutation,
  type MutationStateInfo,
} from "@/data/mutation-guide";
import { MutationGuideTool } from "@/components/tools/mutation-guide-tool";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return allMutationStates().map((s) => ({ state: s.slug }));
}

/** Default guide (residential + sale) — used for the HowTo/FAQ structured data. */
function defaultGuide(s: MutationStateInfo) {
  return buildMutation(
    { stateSlug: s.slug, propertyType: "residential", transferType: "sale" },
    s,
  );
}

function stateFaqs(s: MutationStateInfo): { question: string; answer: string }[] {
  const g = defaultGuide(s);
  const faqs: { question: string; answer: string }[] = [];
  if (s.verified) {
    faqs.push({
      question: `How do I apply for mutation (dakhil-kharij) in ${s.name}?`,
      answer: g.steps.join(" "),
    });
    faqs.push({
      question: `How long does mutation take in ${s.name}?`,
      answer: g.timeline,
    });
    faqs.push({
      question: `What if my mutation is rejected in ${s.name}?`,
      answer: g.appeal,
    });
  } else {
    faqs.push({
      question: `Is there an online mutation portal for ${s.name}?`,
      answer: `A verified step-by-step guide for ${s.name} is coming soon. For now, use your state's official land-records portal or your local Tehsil / Circle Office.`,
    });
  }
  return faqs;
}

export async function generateMetadata(
  { params }: PageProps<"/tools/mutation-guide/[state]">,
): Promise<Metadata> {
  const { state } = await params;
  const s = getMutationState(state);
  if (!s) return {};
  return {
    title: { absolute: `${s.name} Mutation (Dakhil-Kharij) Guide — Step by Step | ${BRAND}` },
    description: s.verified
      ? `How to do mutation / dakhil-kharij in ${s.name}: the official portal, step-by-step process, documents, fees, timeline and what to do if it's rejected.`
      : `Mutation / dakhil-kharij in ${s.name}: documents and general process. A full verified state guide is coming soon.`,
    alternates: { canonical: absoluteUrl(`/tools/mutation-guide/${s.slug}`) },
  };
}

export default async function MutationStatePage({ params }: PageProps<"/tools/mutation-guide/[state]">) {
  const { state: slug } = await params;
  const s = getMutationState(slug);
  if (!s) notFound();

  const g = defaultGuide(s);
  const faqs = stateFaqs(s);
  const faqLd = faqPageJsonLd(faqs);
  const howLd = s.verified
    ? howToJsonLd(
        `How to do mutation (dakhil-kharij) in ${s.name}`,
        g.steps.map((text, i) => ({ name: `Step ${i + 1}`, text })),
        `Step-by-step mutation / dakhil-kharij process for ${s.name}.`,
      )
    : null;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "Mutation guide", url: "/tools/mutation-guide" },
            { name: s.name, url: `/tools/mutation-guide/${s.slug}` },
          ]),
          ...(faqLd ? [faqLd] : []),
          ...(howLd ? [howLd] : []),
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
          <Link href="/tools/mutation-guide" className="hover:text-foreground">Mutation guide</Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{s.name}</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">{s.name} mutation (dakhil-kharij) guide</h1>
          <p className="mt-2 text-muted-foreground">
            {s.verified
              ? `The real step-by-step for ${s.name} — official portal, documents, timeline and the appeal route if it gets stuck.`
              : `A verified ${s.name} guide is coming soon. The document checklist below applies generally; use your state's official portal or Tehsil to apply.`}
          </p>
        </header>

        <MutationGuideTool initialStateSlug={s.slug} />

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
          This is general information, not legal advice. Portals, fees and timelines change and vary
          by district. Check with the local Circle Office / Tehsil or a property lawyer before you
          act or pay any money.
          {g.sources.length > 0 && (
            <>
              {" "}Sources:{" "}
              {g.sources.map((u, i) => (
                <span key={u}>
                  {i > 0 ? ", " : ""}
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline">official</a>
                </span>
              ))}
              . Last reviewed {g.lastUpdated}.
            </>
          )}
        </p>
      </div>
    </>
  );
}
