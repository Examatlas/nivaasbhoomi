import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allMutationStates } from "@/data/mutation-guide";
import { MutationGuideTool } from "@/components/tools/mutation-guide-tool";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: `Mutation (Dakhil-Kharij) Guide — Step by Step | ${BRAND}` },
  description:
    "Free step-by-step mutation / dakhil-kharij guide for Bihar, Jharkhand and UP: the official portal, documents, fees, timeline, status tracking and what to do if it's rejected.",
  alternates: { canonical: absoluteUrl("/tools/mutation-guide") },
};

const FAQS = [
  {
    question: "What is dakhil kharij (mutation) and how long does it take?",
    answer:
      "Dakhil-kharij (mutation) is updating the government land record to show you as the new owner after a sale, inheritance, gift or partition. There is no fixed national timeline — in Bihar and Jharkhand it commonly takes a few weeks, in UP often around 30–45 days, and it varies by Circle Office / Tehsil.",
  },
  {
    question: "Is mutation the same as ownership?",
    answer:
      "No. Your registered deed is your title. Mutation updates the revenue/tax record to your name. But if it isn't done, your ownership isn't reflected in government records and it will block your next sale — so it matters.",
  },
  {
    question: "Can I apply for mutation online?",
    answer:
      "Yes in our core states: Bihar (biharbhumi.bihar.gov.in), Jharkhand (jharbhoomi.jharkhand.gov.in) and UP (vaad.up.nic.in / RCCMS). Applying through the government portal is usually free or low-cost.",
  },
  {
    question: "What if my mutation application is rejected?",
    answer:
      "In Bihar and Jharkhand you can appeal to the DCLR (Deputy Collector, Land Reforms) court with the rejection order and corrected documents. In UP, a rejected/objected case goes to the revenue court (SDM / appellate authority).",
  },
];

export default function MutationIndexPage() {
  const states = allMutationStates();
  const verified = states.filter((s) => s.verified);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "Mutation guide", url: "/tools/mutation-guide" },
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
          <span className="text-foreground">Mutation guide</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Mutation (dakhil-kharij) — the real step-by-step</h1>
          <p className="mt-2 text-muted-foreground">
            Getting your name on the land record shouldn&apos;t take months of chakkars. Pick your
            state and how you got the property for the official portal, documents, timeline and the
            appeal route if it gets stuck.
          </p>
        </header>

        <MutationGuideTool />

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink-950">Guide by state</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {verified.length} state(s) have a full verified guide (Bihar, Jharkhand, UP). Others are
            coming soon.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {states.map((s) => (
              <Link
                key={s.slug}
                href={`/tools/mutation-guide/${s.slug}`}
                className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50"
              >
                {s.name}
                {s.verified && <span className="ml-1 text-meta text-clay-700">★</span>}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 max-w-2xl">
          <h2 className="text-lg font-semibold text-ink-950">Frequently asked</h2>
          <dl className="mt-4 flex flex-col divide-y divide-border">
            {FAQS.map((f) => (
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
        </p>
      </div>
    </>
  );
}
