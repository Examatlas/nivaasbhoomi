import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import {
  allStampDutyStates,
  getStateStampDuty,
  statesWithRates,
  hasVerifiedRate,
  stampDutyVariesByArea,
  resolveStampDutyRate,
  type StateStampDuty,
} from "@/data/stamp-duty-rates";
import { StampDutyLeadTool } from "@/components/tools/stamp-duty-lead-tool";

export const revalidate = 86400;
export const dynamicParams = false; // only the states we know about

export function generateStaticParams() {
  return allStampDutyStates().map((s) => ({ state: s.slug }));
}

/** Headline rate phrase used in the H1 blurb, meta description and FAQ —
 *  area-aware (urban vs rural) for states like MP, gender-aware otherwise. */
function rateBlurb(s: StateStampDuty): string | null {
  const uM = resolveStampDutyRate(s, "male", "urban");
  const uF = resolveStampDutyRate(s, "female", "urban");
  if (!uM || !uF) return null;
  if (stampDutyVariesByArea(s)) {
    const rM = resolveStampDutyRate(s, "male", "rural")!;
    return `about ${uM.stampDutyPct}% in urban (municipal) areas and ${rM.stampDutyPct}% in rural (panchayat) areas, plus ${uM.registrationPct}% registration`;
  }
  const femalePart = uF.stampDutyPct < uM.stampDutyPct ? ` and ${uF.stampDutyPct}% for women` : "";
  return `about ${uM.stampDutyPct}% for general buyers${femalePart}, plus ${uM.registrationPct}% registration`;
}

function stateFaqs(s: StateStampDuty): { question: string; answer: string }[] {
  if (!hasVerifiedRate(s)) {
    return [
      {
        question: `What is the stamp duty rate in ${s.name}?`,
        answer: `We are verifying ${s.name}'s stamp duty and registration rates against the official portal and will publish them soon. We never show a guessed number.`,
      },
    ];
  }
  const uM = resolveStampDutyRate(s, "male", "urban")!;
  const uF = resolveStampDutyRate(s, "female", "urban")!;
  const varies = stampDutyVariesByArea(s);
  const rM = varies ? resolveStampDutyRate(s, "male", "rural")! : null;

  const rateAnswer = varies
    ? `In ${s.name}, stamp duty is about ${uM.stampDutyPct}% in urban (municipal) areas and ${rM!.stampDutyPct}% in rural (panchayat) areas, plus a ${uM.registrationPct}% registration charge.${s.note ? ` ${s.note}` : ""}`
    : `In ${s.name}, stamp duty is about ${uM.stampDutyPct}% for male/general buyers${
        uF.stampDutyPct !== uM.stampDutyPct ? ` and ${uF.stampDutyPct}% for women` : ""
      }, plus a ${uM.registrationPct}% registration charge.${s.note ? ` ${s.note}` : ""}`;

  const faqs = [
    { question: `What is the stamp duty rate in ${s.name}?`, answer: rateAnswer },
    {
      question: `Do women pay less stamp duty in ${s.name}?`,
      answer:
        uF.stampDutyPct < uM.stampDutyPct
          ? `Yes — women buyers in ${s.name} pay about ${uF.stampDutyPct}% instead of ${uM.stampDutyPct}%, a ${(
              uM.stampDutyPct - uF.stampDutyPct
            ).toFixed(2)} percentage-point concession.`
          : `${s.name} does not offer a stamp-duty concession for women; the rate is the same regardless of buyer.`,
    },
    ...(varies
      ? [
          {
            question: `Is stamp duty different in urban and rural areas of ${s.name}?`,
            answer: `Yes. ${s.name} adds a local-body duty on top of the base stamp duty — more in urban/municipal areas than in rural/panchayat areas — so the total is about ${uM.stampDutyPct}% urban versus ${rM!.stampDutyPct}% rural. Registration is ${uM.registrationPct}% either way.`,
          },
        ]
      : []),
    {
      question: `What are the registration charges in ${s.name}?`,
      answer: `The registration charge in ${s.name} is about ${uM.registrationPct}% of the property value${
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
  const blurb = rateBlurb(s);
  const desc = blurb
    ? `Stamp duty in ${s.name} is ${blurb} charges. Calculate the exact stamp duty and registration charges in ${s.name} for any property value.`
    : `Stamp duty and registration charges in ${s.name} — calculator and official portal link.`;
  return {
    // Targets the real search queries: "<state> stamp duty", "stamp duty rate in
    // <state>", "stamp duty and registration charges in <state>".
    title: { absolute: `${s.name} Stamp Duty & Registration Charges — 2026 Rates | ${BRAND}` },
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
  // Internal links to the other verified state pages (SEO cross-linking).
  const others = statesWithRates().filter((x) => x.slug !== s.slug);

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
            {rateBlurb(s)
              ? `Stamp duty in ${s.name} is ${rateBlurb(s)}. Enter your property value for the exact cost.`
              : `We're verifying ${s.name}'s official rates and will publish them soon.`}
          </p>
          {s.rateCaveat && (
            <p className="mt-3 rounded-card border border-clay-100 bg-clay-50 px-4 py-3 text-meta text-clay-800">
              {s.rateCaveat}
              {s.source ? (
                <>
                  {" "}
                  <a
                    href={s.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {s.name} official portal
                  </a>
                </>
              ) : null}
            </p>
          )}
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

        {/* Internal links to other states' stamp-duty pages (SEO). */}
        {others.length > 0 && (
          <section className="mt-10 max-w-2xl">
            <h2 className="text-lg font-semibold text-ink-950">Stamp duty in other states</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/tools/stamp-duty/${o.slug}`}
                  className="rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-ink-800 hover:border-clay-200 hover:bg-clay-50"
                >
                  {o.name}
                </Link>
              ))}
              <Link
                href="/tools/stamp-duty"
                className="rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium text-clay-700 hover:bg-clay-50"
              >
                All states &rarr;
              </Link>
            </div>
          </section>
        )}

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
