import type { Metadata } from "next";
import Link from "next/link";
import { Home, Calculator, Landmark, ArrowRight } from "lucide-react";

import { BRAND, absoluteUrl } from "@/lib/seo/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: `Property Tools & Calculators | ${BRAND}`,
  description:
    "Free home-buying tools: an EMI calculator and a state-wise stamp duty calculator to plan the real cost of your property in India.",
  alternates: { canonical: absoluteUrl("/tools") },
};

const TOOLS = [
  {
    href: "/tools/emi-calculator",
    icon: Calculator,
    title: "EMI calculator",
    body: "Estimate your monthly home-loan EMI, total interest and total payable — with a principal-vs-interest breakdown.",
  },
  {
    href: "/tools/stamp-duty-calculator",
    icon: Landmark,
    title: "Stamp duty calculator",
    body: "See stamp duty + registration charges by state and buyer category, including the concession many states give women.",
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <nav className="mb-4 flex items-center gap-1.5 text-meta text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Tools</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <h1 className="text-display-md">Property tools & calculators</h1>
        <p className="mt-2 text-muted-foreground">
          Plan the real cost of buying a home — loan EMIs and state-wise stamp duty, free.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col gap-3 rounded-card border border-border bg-surface p-6 shadow-card transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-ink-50 text-ink-700">
              <t.icon className="size-6" />
            </span>
            <h2 className="text-lg font-semibold text-ink-950">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.body}</p>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-clay-700">
              Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
