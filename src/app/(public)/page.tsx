import Link from "next/link";
import {
  Sparkles,
  Eye,
  PhoneOff,
  UserCheck,
  BellOff,
  Landmark,
  Calculator,
  ClipboardCheck,
  ArrowRight,
  FileText,
  ShieldCheck,
  IndianRupee,
  Building2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HomeSearch } from "@/components/public/home-search";
import { HomeExperience } from "@/components/public/home/home-experience";
import { CategoryTiles } from "@/components/public/home/category-tiles";
import { JsonLd } from "@/components/shared/json-ld";
import { getHomeData } from "@/lib/listings/home";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import { homeMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600; // ISR — stays static; city is resolved client-side

export const metadata = homeMetadata();

/**
 * Home. City-aware: the header chip + this page resolve the visitor's city
 * client-side (geo cookie), so the "Properties in <city>" section is relevant
 * instead of a mixed nationwide feed. Honest copy — no fake counts, no
 * "verified" claim over demo listings. Stays static/ISR (Section 9).
 */
export default async function HomePage() {
  const home = await getHomeData(6);
  const cityOptions = home.cities.map((c) => ({ name: c.name, slug: c.slug }));

  return (
    <>
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />

      {/* ---------- 1. Hero + search ---------- */}
      <section className="border-b border-border bg-gradient-to-b from-ink-50/60 to-background">
        <div className="mx-auto max-w-page px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Badge tone="clay" className="mb-5">
              <Sparkles className="size-3.5" />
              The dealer&apos;s number is on the page
            </Badge>

            <h1 className="text-display-md text-balance sm:text-display-lg">
              Find a home without{" "}
              <span className="text-clay-600">giving your number away.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Browse every flat, plot and house in full. When you&apos;re ready, message the
              dealer on WhatsApp yourself. No forms, no callbacks, no &quot;sir, when can you
              visit?&quot; at 10pm.
            </p>

            <div className="mt-8 w-full max-w-xl">
              <HomeSearch cities={cityOptions} />
            </div>

            {/* Buyer trust chips (B4). */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-meta text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4 text-ink-600" /> See every listing free
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PhoneOff className="size-4 text-clay-600" /> No phone-number popups
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="size-4 text-ink-600" /> Your number goes to one dealer only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BellOff className="size-4 text-clay-600" /> No spam calls
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2 + 3. Properties in <city> + Browse by city ---------- */}
      <HomeExperience cities={home.cities} />

      {/* ---------- 4. What are you looking for? ---------- */}
      <CategoryTiles />

      {/* ---------- 5. Privacy strip (navy) ---------- */}
      <section className="bg-ink-950 text-white">
        <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
          <h2 className="max-w-2xl text-display-sm text-white">
            Most property sites sell your number. We don&apos;t have a way to.
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <TrustPoint
              icon={PhoneOff}
              title="Your phone stays quiet"
              body="Nobody calls you 40 times. You start the conversation, on WhatsApp, when you want to."
            />
            <TrustPoint
              icon={FileText}
              title="The number is on the page"
              body={`Not behind a form. Not after signup. Not "our executive will reach out shortly."`}
            />
            <TrustPoint
              icon={UserCheck}
              title="One enquiry, one dealer"
              body="Your enquiry goes to the dealer whose listing you opened. It isn't resold to five brokers."
            />
          </div>
        </div>
      </section>

      {/* ---------- 6. Honest stats ---------- */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={String(home.stats.citiesLive)} label="cities live" />
            <Stat value={String(home.stats.totalListings)} label="listings on the site" />
            <Stat value="0" label="spam calls made" />
            <Stat value="₹0" label="charged to dealers" />
          </div>
        </div>
      </section>

      {/* ---------- 7. Free tools ---------- */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
          <h2 className="text-display-sm">Free tools to plan your purchase</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Know the real cost before you buy — no login needed to start.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ToolCard
              href="/tools/stamp-duty"
              icon={Landmark}
              title="Stamp duty calculator"
              body="State-wise stamp duty and registration, with the women's concession."
            />
            <ToolCard
              href="/tools/emi-calculator"
              icon={Calculator}
              title="EMI calculator"
              body="Monthly home-loan EMI, total interest and payable."
            />
            <ToolCard
              href="/tools/property-checklist"
              icon={ClipboardCheck}
              title="Legal checklist"
              body="The papers to check before you buy, state by state."
            />
          </div>
        </div>
      </section>

      {/* ---------- 8. Dealer CTA (orange) ---------- */}
      <section className="bg-gradient-to-br from-clay-500 to-clay-700 text-white">
        <div className="mx-auto max-w-page px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-display-sm text-white">List your property, keep the lead</h2>
            <p className="mx-auto mt-3 max-w-xl text-clay-50">
              Put your flats, plots and houses in front of buyers who came to look, not to be
              chased. Free to list, free to receive leads.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <DealerSignal icon={ShieldCheck} text="Every buyer's number is WhatsApp OTP verified" />
              <DealerSignal icon={UserCheck} text="Each lead goes to one dealer only" />
              <DealerSignal icon={IndianRupee} text="Listings and leads both free — no subscription" />
            </div>
            <div className="mt-8">
              <Link
                href="/dealer/login"
                className="inline-flex items-center gap-2 rounded-control bg-white px-6 py-3 text-sm font-semibold text-clay-700 shadow-card transition-colors hover:bg-clay-50"
              >
                <Building2 className="size-4" />
                List your property
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TrustPoint({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-clay-200">
        <Icon className="size-5" />
      </span>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-sm text-ink-100">{body}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-display-sm tabular text-ink-950">{value}</p>
      <p className="mt-1 text-meta text-muted-foreground">{label}</p>
    </div>
  );
}

function ToolCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-card transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-700">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold text-ink-950">
          {title}
          <ArrowRight className="size-4 text-clay-700 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}

function DealerSignal({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-meta text-clay-50">
      <Icon className="size-4 shrink-0" />
      {text}
    </span>
  );
}
