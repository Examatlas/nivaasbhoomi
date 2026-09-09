import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allCntSptDistricts, getCntSptDistrict, type CntSptDistrict } from "@/data/cnt-spt-districts";
import { CntSptTool } from "@/components/tools/cnt-spt-tool";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return allCntSptDistricts().map((d) => ({ district: d.slug }));
}

function districtFaqs(d: CntSptDistrict): { question: string; answer: string }[] {
  const actName = d.act === "SPT" ? "SPT Act, 1949" : "CNT Act, 1908";
  return [
    {
      question: `Can a non-tribal buy land in ${d.name}?`,
      answer:
        d.act === "SPT"
          ? `${d.name} is in the Santhal Pargana division, under the ${actName}. Tenant (raiyati) land here is largely non-transferable (Section 20), so a sale to a non-tribal is generally not valid. Verify the specific plot's record at the Circle Office.`
          : `${d.name} is under the ${actName}. Land recorded as tribal (ST) land generally cannot be sold to a non-tribal (Section 46). Non-tribal-owned land may be transferable, but you must check the plot's record-of-rights (khatiyan) at the Circle Office first.`,
    },
    {
      question: `Which land law applies in ${d.name}?`,
      answer: `${d.name} (${d.division} division) is governed by the ${actName}.`,
    },
    {
      question: `Can a tribal (ST) buyer purchase land in ${d.name}?`,
      answer:
        d.act === "SPT"
          ? `Even tribal-to-tribal transfer in ${d.name} is tightly restricted — valid only where the right to transfer is recorded in the record-of-rights, with the Deputy Commissioner's permission for the narrow exceptions (SPT Act, Section 20).`
          : `A Scheduled-Tribe buyer can generally buy tribal land in ${d.name} only within the same police-station area, and only with the Deputy Commissioner's written permission (CNT Act, Section 46).`,
    },
    {
      question: `Can you get a home loan on this land?`,
      answer:
        "Usually not — because CNT/SPT land cannot be freely sold or mortgaged, most banks refuse a home loan against it. Confirm with your bank before paying any money.",
    },
  ];
}

export async function generateMetadata(
  { params }: PageProps<"/tools/cnt-spt-check/[district]">,
): Promise<Metadata> {
  const { district } = await params;
  const d = getCntSptDistrict(district);
  if (!d) return {};
  return {
    title: { absolute: `Can You Buy Land in ${d.name}? CNT/SPT Rules | ${BRAND}` },
    description: `${d.name} land: is it under the ${d.act} Act? Who can buy, what Deputy Commissioner (DC) permission is needed, documents, and the home-loan catch. Free checker with official sources.`,
    alternates: { canonical: absoluteUrl(`/tools/cnt-spt-check/${d.slug}`) },
  };
}

export default async function CntSptDistrictPage({ params }: PageProps<"/tools/cnt-spt-check/[district]">) {
  const { district: slug } = await params;
  const d = getCntSptDistrict(slug);
  if (!d) notFound();

  const faqs = districtFaqs(d);
  const faqLd = faqPageJsonLd(faqs);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Tools", url: "/tools" },
            { name: "CNT/SPT land check", url: "/tools/cnt-spt-check" },
            { name: d.name, url: `/tools/cnt-spt-check/${d.slug}` },
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
          <Link href="/tools/cnt-spt-check" className="hover:text-foreground">CNT/SPT check</Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{d.name}</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Buying land in {d.name}? CNT / SPT rules</h1>
          <p className="mt-2 text-muted-foreground">
            {d.name} ({d.division} division) is governed by the{" "}
            <b>{d.act === "SPT" ? "SPT Act, 1949" : "CNT Act, 1908"}</b>. Pick your buyer type below
            for a clear answer, the permission needed and the home-loan warning.
          </p>
        </header>

        <CntSptTool initialDistrictSlug={d.slug} />

        <section className="mt-12 max-w-2xl">
          <h2 className="text-lg font-semibold text-ink-950">{d.name} — frequently asked</h2>
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
          This is general information, not legal advice. Land laws change and vary by the specific
          plot&apos;s record. Check with the local Circle Office (Anchal) or a property lawyer before
          you buy or pay any money.
        </p>
      </div>
    </>
  );
}
