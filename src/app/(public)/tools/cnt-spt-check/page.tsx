import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allCntSptDistricts } from "@/data/cnt-spt-districts";
import { CntSptTool } from "@/components/tools/cnt-spt-tool";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: `CNT / SPT Land Checker — Can You Buy Land in Jharkhand? | ${BRAND}` },
  description:
    "Free Jharkhand CNT/SPT land checker: find out if a district is under the CNT Act 1908 or SPT Act 1949, whether your buyer type can buy, what DC permission is needed, and the home-loan catch. Verified sources.",
  alternates: { canonical: absoluteUrl("/tools/cnt-spt-check") },
};

const FAQS = [
  {
    question: "Can a non-tribal buy CNT land in Ranchi?",
    answer:
      "Land recorded as tribal (Scheduled Tribe) land in Ranchi — a CNT Act district — generally cannot be sold to a non-tribal (CNT Act, 1908, Section 46). Verify the plot's record-of-rights (khatiyan) at the Circle Office; if it is tribal land, treat it as not available to a non-tribal.",
  },
  {
    question: "Which Jharkhand districts are under CNT and which under SPT?",
    answer:
      "The SPT Act 1949 covers the 6 Santhal Pargana districts: Dumka, Deoghar, Godda, Pakur, Sahibganj and Jamtara. The CNT Act 1908 covers the other 18 districts — the North Chotanagpur, South Chotanagpur, Palamu and Kolhan divisions.",
  },
  {
    question: "Does SPT land need DC permission?",
    answer:
      "In the Santhal Pargana (SPT) districts, tenant (raiyati) land is largely non-transferable under Section 20 of the SPT Act. The narrow exceptions that are allowed need the Deputy Commissioner's (DC) written permission.",
  },
  {
    question: "Can you get a home loan on CNT or SPT land?",
    answer:
      "Usually not. Because CNT/SPT land cannot be freely sold or mortgaged, most banks refuse a home loan against it. Confirm with your bank before you pay any money.",
  },
];

export default function CntSptIndexPage() {
  const districts = allCntSptDistricts();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "CNT/SPT land check", url: "/tools/cnt-spt-check" },
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
          <span className="text-foreground">CNT / SPT land check</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Can you buy this land? Jharkhand CNT / SPT checker</h1>
          <p className="mt-2 text-muted-foreground">
            Jharkhand&apos;s biggest land question, answered plainly. Pick a district and your buyer
            type to see whether the CNT or SPT Act applies, whether the purchase is allowed, what
            permission is needed — and why a home loan is usually not available.
          </p>
        </header>

        <CntSptTool />

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-ink-950">Check by district</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All 24 Jharkhand districts — CNT Act (18) or SPT Act (6).
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {districts.map((d) => (
              <Link
                key={d.slug}
                href={`/tools/cnt-spt-check/${d.slug}`}
                className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50"
              >
                {d.name}
                <span className="ml-1 text-meta text-clay-700">{d.act}</span>
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
          This is general information, not legal advice. Land laws change and vary by district and
          by the specific plot. Check with the local Circle Office (Anchal) or a property lawyer
          before you buy or pay any money.
        </p>
      </div>
    </>
  );
}
