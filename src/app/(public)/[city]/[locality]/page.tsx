import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, MapPin, TrendingUp, Route } from "lucide-react";

import {
  resolveActiveCityLocality,
  countApproved,
  fetchApprovedCards,
  computeRateRange,
  getRelatedLocalities,
  getStaticLocalityParams,
  THIN_PAGE_MIN,
  type RateRange,
} from "@/lib/listings/query";
import { localityMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, faqPageJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { formatPrice, formatRent } from "@/lib/utils/price";

import { JsonLd } from "@/components/shared/json-ld";
import { ListingGrid } from "@/components/public/listing-grid";
import { LocalityFilters } from "@/components/public/locality-filters";
import { SaveAlertButton } from "@/components/alerts/save-alert-button";
import { FaqAccordion } from "@/components/public/faq-accordion";
import type { ListingCardData } from "@/types/listing";

export const revalidate = 3600;

interface LocalityPageData {
  city: { id: string; name: string; slug: string };
  locality: {
    id: string;
    name: string;
    slug: string;
    introText?: string;
    connectivity?: string;
    faq: { question: string; answer: string }[];
  };
  listings: ListingCardData[];
  count: number;
  rate: RateRange;
  related: { name: string; slug: string }[];
}

// Shared, cached per request across generateMetadata + the page.
const load = cache(
  async (citySlug: string, localitySlug: string): Promise<LocalityPageData | null> => {
    const resolved = await resolveActiveCityLocality(citySlug, localitySlug);
    if (!resolved) return null;

    const count = await countApproved(resolved.locality.id);
    // Thin-page guard (Section 10): < 3 approved listings must 404.
    if (count < THIN_PAGE_MIN) return null;

    const [listings, rate, related] = await Promise.all([
      fetchApprovedCards({
        localityId: resolved.locality.id,
        cityName: resolved.city.name,
        localityName: resolved.locality.name,
      }),
      computeRateRange(resolved.locality.id),
      getRelatedLocalities(resolved.city.id, resolved.locality.id),
    ]);

    return { ...resolved, listings, count, rate, related };
  },
);

export async function generateStaticParams() {
  return getStaticLocalityParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/[city]/[locality]">): Promise<Metadata> {
  const { city, locality } = await params;
  const data = await load(city, locality);
  if (!data)
    return { title: "Locality not found", robots: { index: false, follow: false } };

  return localityMetadata({
    localityName: data.locality.name,
    cityName: data.city.name,
    citySlug: data.city.slug,
    localitySlug: data.locality.slug,
    typeLabel: "Property",
    listingCount: data.count,
    rateMin: data.rate.saleMin ?? data.rate.rentMin,
    rateMax: data.rate.saleMax ?? data.rate.rentMax,
    image: data.listings[0]?.photo?.url,
  });
}

export default async function LocalityPage({ params }: PageProps<"/[city]/[locality]">) {
  const { city, locality } = await params;
  const data = await load(city, locality);
  if (!data) notFound();

  const { rate } = data;
  const hasSale = rate.saleMin != null && rate.saleMax != null;
  const hasRent = rate.rentMin != null && rate.rentMax != null;

  const jsonld = [
    breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: data.city.name, url: `/${data.city.slug}` },
      { name: data.locality.name, url: `/${data.city.slug}/${data.locality.slug}` },
    ]),
    itemListJsonLd(
      data.listings.map((l) => ({ url: `/property/${l.slug}`, name: l.title })),
    ),
    faqPageJsonLd(data.locality.faq),
  ].filter(Boolean) as Record<string, unknown>[];

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
          <Link href={`/${data.city.slug}`} className="hover:text-foreground">
            {data.city.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{data.locality.name}</span>
        </nav>

        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-display-sm">
              Property in {data.locality.name}, {data.city.name}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 text-clay-500" />
              {data.count} verified {data.count === 1 ? "listing" : "listings"} · direct
              WhatsApp contact
            </p>
          </div>
          <SaveAlertButton
            criteria={{
              cityId: data.city.id,
              localityIds: [data.locality.id],
              purpose: "buy",
            }}
            label="Alert me about new listings"
          />
        </header>

        {/* Rate range */}
        <div className="mb-5">
          {hasSale || hasRent ? (
            <>
              <div className="flex flex-wrap gap-3">
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
              <p className="mt-2 text-meta text-muted-foreground">
                Indicative rates. Actual prices may vary.
              </p>
            </>
          ) : (
            <p className="text-meta text-muted-foreground">Not enough data yet.</p>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6">
          <LocalityFilters citySlug={data.city.slug} localitySlug={data.locality.slug} />
        </div>

        {/* Listings */}
        <ListingGrid listings={data.listings} />

        {/* Intro + connectivity */}
        {(data.locality.introText || data.locality.connectivity) && (
          <section className="mt-10 max-w-prose">
            {data.locality.introText && (
              <>
                <h2 className="text-display-sm">About {data.locality.name}</h2>
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {data.locality.introText}
                </p>
              </>
            )}
            {data.locality.connectivity && (
              <div className="mt-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                  <Route className="size-5 text-clay-600" /> Connectivity
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {data.locality.connectivity}
                </p>
              </div>
            )}
          </section>
        )}

        {/* FAQ */}
        {data.locality.faq.length > 0 && (
          <section className="mt-10 max-w-prose">
            <h2 className="mb-4 text-display-sm">Frequently asked questions</h2>
            <FaqAccordion faqs={data.locality.faq} />
          </section>
        )}

        {/* Related localities */}
        {data.related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink-950">
              <TrendingUp className="size-5 text-clay-600" /> Other localities in{" "}
              {data.city.name}
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${data.city.slug}/${r.slug}`}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-meta text-foreground transition-colors hover:bg-surface-muted"
                >
                  {r.name}
                </Link>
              ))}
              <Link
                href={`/${data.city.slug}`}
                className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-meta font-medium text-ink-800 transition-colors hover:bg-ink-100"
              >
                All of {data.city.name} →
              </Link>
            </div>
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
