import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, MapPin, TrendingUp, Building2 } from "lucide-react";

import {
  resolveDisplayCity,
  countApprovedInCity,
  countRealApprovedInCity,
  computeCityRateRange,
  getCityPopularLocalities,
  getCityListings,
  getActiveCities,
  type RateRange,
} from "@/lib/listings/query";
import { cityMetadata } from "@/lib/seo/metadata";
import { CITY_INDEX_MIN_LISTINGS } from "@/lib/config/activation";
import { breadcrumbJsonLd, faqPageJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { formatPrice, formatRent } from "@/lib/utils/price";

import { JsonLd } from "@/components/shared/json-ld";
import { ListingGrid } from "@/components/public/listing-grid";
import { CityFilters } from "@/components/public/city-filters";
import { FaqAccordion } from "@/components/public/faq-accordion";
import type { ListingCardData } from "@/types/listing";

export const revalidate = 3600;

interface CityPageData {
  city: {
    id: string;
    name: string;
    slug: string;
    introText?: string;
    faq: { question: string; answer: string }[];
  };
  count: number;
  /** REAL (non-seed) approved listings — drives the SEO index/noindex gate. */
  realCount: number;
  rate: RateRange;
  localities: { name: string; slug: string; listingCount: number }[];
  listings: ListingCardData[];
  /** False for an inactive city shown only because it has seed listings (B5) —
   *  then the page is noindex and skips the rate/locality (real-data) sections. */
  isActive: boolean;
}

const load = cache(async (citySlug: string): Promise<CityPageData | null> => {
  const city = await resolveDisplayCity(citySlug);
  if (!city) return null; // inactive + no seed / missing → 404 (Section 9)

  // Inactive city shown only for its seed listings: minimal, noindex page
  // (realCount 0 — seed listings never make a page indexable).
  if (!city.isActive) {
    const listings = await getCityListings(city.id, city.name, 12);
    return { city, count: listings.length, realCount: 0, rate: {}, localities: [], listings, isActive: false };
  }

  const [count, realCount, rate, localities, listings] = await Promise.all([
    countApprovedInCity(city.id),
    countRealApprovedInCity(city.id),
    computeCityRateRange(city.id),
    getCityPopularLocalities(city.id),
    getCityListings(city.id, city.name, 12),
  ]);

  return { city, count, realCount, rate, localities, listings, isActive: true };
});

// Only ACTIVE cities are prebuilt; dynamicParams stays true so a newly-activated
// city resolves on demand (and an inactive one 404s at request time).
export async function generateStaticParams() {
  const cities = await getActiveCities();
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[city]">): Promise<Metadata> {
  const { city } = await params;
  const data = await load(city);
  if (!data) return { title: "City not found", robots: { index: false, follow: false } };

  const meta = cityMetadata({
    cityName: data.city.name,
    citySlug: data.city.slug,
    listingCount: data.count,
    topLocalities: data.localities.slice(0, 2).map((l) => l.name),
  });
  // SEO thin-content guard: noindex an inactive (seed-only) city, AND any active
  // city with fewer than CITY_INDEX_MIN_LISTINGS *real* (non-seed) listings.
  // Seed listings show the city but have no contact button, so a buyer from
  // Google would bounce — we only index once there's real, contactable depth.
  if (!data.isActive || data.realCount < CITY_INDEX_MIN_LISTINGS) {
    meta.robots = { index: false, follow: false };
  }
  return meta;
}

export default async function CityPage({ params }: PageProps<"/[city]">) {
  const { city } = await params;
  const data = await load(city);
  if (!data) notFound();

  const { rate } = data;
  const hasSale = rate.saleMin != null && rate.saleMax != null;
  const hasRent = rate.rentMin != null && rate.rentMax != null;

  // Seed-only (inactive) city: only breadcrumb — no listing/FAQ structured data.
  const jsonld = (
    data.isActive
      ? [
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: data.city.name, url: `/${data.city.slug}` },
          ]),
          itemListJsonLd(
            data.listings.map((l) => ({ url: `/property/${l.slug}`, name: l.title })),
          ),
          faqPageJsonLd(data.city.faq),
        ]
      : [
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: data.city.name, url: `/${data.city.slug}` },
          ]),
        ]
  ).filter(Boolean) as Record<string, unknown>[];

  return (
    <>
      <JsonLd data={jsonld} />

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{data.city.name}</span>
        </nav>

        <header className="mb-5">
          <h1 className="text-display-md">Property in {data.city.name}</h1>
          {data.isActive ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 text-clay-500" />
              {data.count} verified {data.count === 1 ? "listing" : "listings"} ·{" "}
              {data.localities.length} localities · direct WhatsApp contact
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 text-clay-500" />
              We&apos;re building verified inventory in {data.city.name} — here&apos;s a preview.
              Set an alert to hear the moment real listings go live.
            </p>
          )}
        </header>

        {/* Rate range */}
        {(hasSale || hasRent) && (
          <div className="mb-6 flex flex-wrap gap-3">
            {hasSale && (
              <RateCard
                label="Sale price range"
                value={`${formatPrice(rate.saleMin!)} – ${formatPrice(rate.saleMax!)}`}
                sub={
                  rate.avgPricePerSqft
                    ? `avg ₹${rate.avgPricePerSqft.toLocaleString("en-IN")}/sq.ft.`
                    : undefined
                }
              />
            )}
            {hasRent && (
              <RateCard
                label="Rent range"
                value={`${formatRent(rate.rentMin!)} – ${formatRent(rate.rentMax!)} /mo`}
              />
            )}
          </div>
        )}

        {/* Filters -> route to indexable locality/filter pages */}
        {data.localities.length > 0 && (
          <section className="mb-6">
            <CityFilters citySlug={data.city.slug} localities={data.localities} />
          </section>
        )}

        {/* Popular localities */}
        {data.localities.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink-950">
              <Building2 className="size-5 text-clay-600" /> Popular localities in{" "}
              {data.city.name}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.localities.map((l) => (
                <Link
                  key={l.slug}
                  href={`/${data.city.slug}/${l.slug}`}
                  className="group flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-muted"
                >
                  <span className="font-medium text-ink-950 group-hover:text-ink-700">
                    {l.name}
                  </span>
                  {l.listingCount > 0 && (
                    <span className="tabular text-meta text-muted-foreground">
                      {l.listingCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured / newest listings */}
        {data.listings.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="size-5 text-clay-600" />
              <h2 className="text-lg font-semibold text-ink-950">
                Newest in {data.city.name}
              </h2>
            </div>
            <ListingGrid listings={data.listings} />
          </section>
        )}

        {/* Intro text */}
        {data.city.introText && (
          <section className="mt-8 max-w-prose">
            <h2 className="text-display-sm">About property in {data.city.name}</h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {data.city.introText}
            </p>
          </section>
        )}

        {/* FAQ */}
        {data.city.faq.length > 0 && (
          <section className="mt-10 max-w-prose">
            <h2 className="mb-4 text-display-sm">Frequently asked questions</h2>
            <FaqAccordion faqs={data.city.faq} />
          </section>
        )}
      </div>
    </>
  );
}

function RateCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <p className="text-overline text-subtle-foreground uppercase">{label}</p>
      <p className="tabular mt-0.5 text-price text-ink-950">{value}</p>
      {sub && <p className="text-meta text-muted-foreground">{sub}</p>}
    </div>
  );
}
