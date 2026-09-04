import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { getStampDutyStates } from "@/lib/calculators/states";
import { StampDutyCalculator } from "@/components/public/stamp-duty-calculator";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `State-wise Stamp Duty Calculator | ${BRAND}`,
  description:
    "Calculate stamp duty and registration charges on property in India by state and buyer category, including the concession many states offer women.",
  alternates: { canonical: absoluteUrl("/tools/stamp-duty-calculator") },
};

export default async function StampDutyCalculatorPage() {
  const states = await getStampDutyStates();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Stamp duty calculator", url: "/tools/stamp-duty-calculator" },
        ])}
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
          <h1 className="text-display-md">State-wise stamp duty calculator</h1>
          <p className="mt-2 text-muted-foreground">
            Stamp duty varies by state and by who&apos;s buying — many states charge women
            less. Pick your state and buyer to see the real cost.
          </p>
        </header>

        <StampDutyCalculator states={states} />
      </div>
    </>
  );
}
