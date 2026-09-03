import Link from "next/link";
import {
  ShieldCheck,
  MessageCircle,
  Sparkles,
  Clock,
  Search,
  Handshake,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ListingGrid } from "@/components/public/listing-grid";
import { HomeSearch } from "@/components/public/home-search";
import { JsonLd } from "@/components/shared/json-ld";
import { getFeaturedListings, getActiveCities } from "@/lib/listings/query";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";

export const revalidate = 3600; // ISR

/**
 * Home. Real hero + city selector (active cities only) + newest listings across
 * launched cities + how-it-works + trust signals. Organization + WebSite +
 * SearchAction JSON-LD.
 */
export default async function HomePage() {
  const [featured, cities] = await Promise.all([
    getFeaturedListings(8),
    getActiveCities(),
  ]);

  return (
    <>
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />

      {/* ---------- Hero ---------- */}
      <section className="border-b border-border bg-gradient-to-b from-ink-50/60 to-background">
        <div className="mx-auto max-w-page px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Badge tone="clay" className="mb-5">
              <Sparkles className="size-3.5" />
              No spam calls. Contact on WhatsApp.
            </Badge>

            <h1 className="text-display-md text-balance sm:text-display-lg">
              Find your next home,{" "}
              <span className="text-clay-600">contact directly.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Verified flats, plots and houses across India. See every listing freely - no
              phone-number popups, no brokers spamming your phone.
            </p>

            <div className="mt-8 w-full max-w-xl">
              <HomeSearch cities={cities.map((c) => ({ name: c.name, slug: c.slug }))} />
            </div>

            {/* City selector - active cities only */}
            {cities.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="text-meta text-muted-foreground">Popular cities:</span>
                {cities.slice(0, 8).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${c.slug}`}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-meta font-medium text-ink-800 transition-colors hover:bg-surface-muted"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-meta text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-ink-600" />
                Verified dealers only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-4 text-wa-600" />
                Direct WhatsApp contact
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-clay-600" />
                Fresh, dated listings
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Featured ---------- */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-page px-4 py-14 sm:px-6">
          <div className="mb-6">
            <h2 className="text-display-sm">Latest verified listings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Freshly verified property, contact directly on WhatsApp.
            </p>
          </div>
          <ListingGrid listings={featured} />
        </section>
      )}

      {/* ---------- How it works ---------- */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
          <h2 className="text-center text-display-sm">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Step
              icon={Search}
              n={1}
              title="Search freely"
              body="Browse every verified listing with full photos, price and area. No login, no phone-number popups."
            />
            <Step
              icon={MessageCircle}
              n={2}
              title="Tap WhatsApp"
              body="One tap opens WhatsApp with the listing details pre-filled. No forms, no waiting for a callback."
            />
            <Step
              icon={Handshake}
              n={3}
              title="Talk directly"
              body="Chat with the verified dealer directly, schedule a visit, and close - on your terms."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function Step({
  icon: Icon,
  n,
  title,
  body,
}: {
  icon: React.ElementType;
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative flex size-12 items-center justify-center rounded-full bg-ink-50 text-ink-700">
        <Icon className="size-6" />
        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-clay-600 text-overline font-bold text-white">
          {n}
        </span>
      </div>
      <h3 className="text-base font-semibold text-ink-950">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
