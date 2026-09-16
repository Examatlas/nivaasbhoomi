import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allStampDutyStates, statesWithRates, hasVerifiedRate } from "@/data/stamp-duty-rates";
import { StampDutyLeadTool } from "@/components/tools/stamp-duty-lead-tool";

// Static / ISR (daily). Never dynamic — keeps the companion-cookie header intact.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: `Stamp Duty Calculator — State-wise 2026 Rates | ${BRAND}` },
  description:
    "Free state-wise stamp duty & registration charge calculator for India. See the real cost by state and buyer — including the concession many states give women.",
  alternates: { canonical: absoluteUrl("/tools/stamp-duty") },
};

const FAQS = [
  {
    question: "What is stamp duty on property?",
    answer:
      "Stamp duty is a state tax you pay to legally register a property purchase. It is a percentage of the property value (or the government circle/guideline value, whichever is higher) and varies by state.",
  },
  {
    question: "Do women pay less stamp duty in India?",
    answer:
      "In many states — Delhi, Uttar Pradesh, Haryana, Punjab, Rajasthan, Himachal Pradesh, Uttarakhand, Odisha and others — women buyers get a concession of 1–2 percentage points. Some states (Karnataka, Tamil Nadu, Kerala, Telangana) give no gender concession, and Gujarat instead waives the registration fee for sole female owners.",
  },
  {
    question: "Is the registration charge separate from stamp duty?",
    answer:
      "Yes. The registration charge is a separate fee (commonly around 1%, but as high as 2–4% in some states) paid on top of stamp duty. Our calculator shows both, plus the grand total.",
  },
  {
    question: "How accurate are these figures?",
    answer:
      "These are researched estimates for residential urban property, with the state's official portal linked for confirmation. Always verify the exact amount at your sub-registrar office, as cesses, caps and circle rates can change the final figure.",
  },
];

export default function StampDutyIndexPage() {
  const states = allStampDutyStates();
  const supported = statesWithRates();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "Stamp duty calculator", url: "/tools/stamp-duty" },
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
          <span className="text-foreground">Stamp duty calculator</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Stamp duty & registration calculator</h1>
          <p className="mt-2 text-muted-foreground">
            Stamp duty varies by state and by who&apos;s buying — many states charge women less.
            Pick your state and buyer to see the real, itemised cost.
          </p>
        </header>

        <StampDutyLeadTool />

        {/* Supported states — internal links to each state page (SEO) */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink-950">Stamp duty by state</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {supported.length} states with verified rates — open your state for its rates and FAQs.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {states.map((s) => (
              <Link
                key={s.slug}
                href={`/tools/stamp-duty/${s.slug}`}
                className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50"
              >
                {s.name}
                {!hasVerifiedRate(s) && <span className="ml-1 text-meta text-muted-foreground">(soon)</span>}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink-950">Related tools</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/tools/mutation-guide" className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50">
              After registration: mutation (dakhil-kharij) guide
            </Link>
            <Link href="/tools/property-checklist" className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50">
              Property legal checklist
            </Link>
          </div>
        </section>

        <p className="mt-8 rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-meta text-warning-700">
          These are estimates for residential urban property. Actual stamp duty depends on the
          circle/guideline value, cesses and caps — confirm at your sub-registrar office.
        </p>
      </div>
    </>
  );
}
