import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { allStampDutyStates, getStateStampDuty, type StateStampDuty } from "@/data/stamp-duty-rates";
import { StampDutyLeadTool } from "@/components/tools/stamp-duty-lead-tool";

export const revalidate = 86400;
export const dynamicParams = false; // only the states we know about

export function generateStaticParams() {
  return allStampDutyStates().map((s) => ({ state: s.slug }));
}

function stateFaqs(s: StateStampDuty): { question: string; answer: string }[] {
  if (!s.stampDuty || s.registrationPct == null) {
    return [
      {
        question: `What is the stamp duty rate in ${s.name}?`,
        answer: `We are verifying ${s.name}'s stamp duty and registration rates against the official portal and will publish them soon. We never show a guessed number.`,
      },
    ];
  }
  const r = s.stampDuty;
  const faqs = [
    {
      question: `What is the stamp duty rate in ${s.name}?`,
      answer: `In ${s.name}, stamp duty is about ${r.male}% for male/general buyers${
        r.female !== r.male ? ` and ${r.female}% for women` : ""
      }, plus a ${s.registrationPct}% registration charge.${s.note ? ` ${s.note}` : ""}`,
    },
    {
      question: `Do women pay less stamp duty in ${s.name}?`,
      answer:
        r.female < r.male
          ? `Yes — women buyers in ${s.name} pay about ${r.female}% instead of ${r.male}%, a ${(
              r.male - r.female
            ).toFixed(2)} percentage-point concession.`
          : `${s.name} does not offer a stamp-duty concession for women; the rate is the same (${r.male}%) regardless of buyer.`,
    },
    {
      question: `What are the registration charges in ${s.name}?`,
      answer: `The registration charge in ${s.name} is about ${s.registrationPct}% of the property value${
        s.registrationCap ? `, capped at ${s.registrationCap}` : ""
      }. It is paid in addition to stamp duty.`,
    },
  ];
  return faqs;
}

export async function generateMetadata(
  { params }: PageProps<"/tools/stamp-duty/[state]">,
): Promise<Metadata> {
  const { state } = await params;
  const s = getStateStampDuty(state);
  if (!s) return {};
  const canonical = absoluteUrl(`/tools/stamp-duty/${s.slug}`);
  const desc = s.stampDuty
    ? `${s.name} stamp duty is about ${s.stampDuty.male}% (male) / ${s.stampDuty.female}% (female) plus ${s.registrationPct}% registration. Calculate your exact cost for any property value.`
    : `Stamp duty and registration rates for ${s.name} — calculator and official portal link.`;
  return {
    title: { absolute: `${s.name} Stamp Duty Calculator — 2026 Rates | ${BRAND}` },
    description: desc,
    alternates: { canonical },
  };
}

// Next 15/16: params is a Promise.
export default async function StampDutyStatePage({ params }: PageProps<"/tools/stamp-duty/[state]">) {
  const { state: slug } = await params;
  const s = getStateStampDuty(slug);
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
            { name: "Stamp duty calculator", url: "/tools/stamp-duty" },
            { name: s.name, url: `/tools/stamp-duty/${s.slug}` },
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
          <Link href="/tools/stamp-duty" className="hover:text-foreground">Stamp duty</Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{s.name}</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">{s.name} stamp duty calculator</h1>
          <p className="mt-2 text-muted-foreground">
            {s.stampDuty
              ? `Stamp duty in ${s.name} is about ${s.stampDuty.male}% for general buyers${
                  s.stampDuty.female < s.stampDuty.male ? ` and ${s.stampDuty.female}% for women` : ""
                }, plus ${s.registrationPct}% registration. Enter your property value for the exact cost.`
              : `We're verifying ${s.name}'s official rates and will publish them soon.`}
          </p>
        </header>

        <StampDutyLeadTool initialStateSlug={s.slug} />

        {/* FAQ (matches the FAQPage JSON-LD) */}
        <section className="mt-12 max-w-2xl">
          <h2 className="text-lg font-semibold text-ink-950">
            {s.name} stamp duty — frequently asked
          </h2>
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
          Estimate for residential urban property. Actual charges depend on the circle/guideline
          value, cesses and caps — confirm at the sub-registrar office.{" "}
          Rates last updated {s.lastUpdated}
          {s.source ? (
            <>
              {" · "}
              <a href={s.source} target="_blank" rel="noopener noreferrer" className="underline">
                {s.name} official portal
              </a>
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}
