import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";
import { EmiCalculator } from "@/components/public/emi-calculator";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Home Loan EMI Calculator | ${BRAND}`,
  description:
    "Calculate your home-loan EMI from the loan amount, interest rate and tenure. See total interest and total payable, with a principal-vs-interest breakdown.",
  alternates: { canonical: absoluteUrl("/tools/emi-calculator") },
};

export default function EmiCalculatorPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "EMI calculator", url: "/tools/emi-calculator" },
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
          <span className="text-foreground">EMI calculator</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Home loan EMI calculator</h1>
          <p className="mt-2 text-muted-foreground">
            Move the sliders to see your monthly EMI and how much of it is interest.
          </p>
        </header>

        <EmiCalculator />
      </div>
    </>
  );
}
