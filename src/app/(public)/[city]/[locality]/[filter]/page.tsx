import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, MapPin } from "lucide-react";

import {
  resolveActiveCityLocality,
  countApproved,
  fetchApprovedCards,
  getStaticFilterParams,
  THIN_PAGE_MIN,
} from "@/lib/listings/query";
import { parseFilterSegment, type FilterQuery } from "@/lib/filters/parse";
import { describeFilter } from "@/lib/filters/describe";
import { filterMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";

import { JsonLd } from "@/components/shared/json-ld";
import { ListingGrid } from "@/components/public/listing-grid";
import { LocalityFilters } from "@/components/public/locality-filters";
import type { ListingCardData } from "@/types/listing";

export const revalidate = 3600;

interface FilterPageData {
  city: { id: string; name: string; slug: string };
  locality: { id: string; name: string; slug: string };
  filter: FilterQuery;
  filterLabel: string;
  listings: ListingCardData[];
  count: number;
}

const load = cache(
  async (
    citySlug: string,
    localitySlug: string,
    filterSegment: string,
  ): Promise<FilterPageData | null> => {
    // Junk-URL guard (Section 9): unmatched pattern -> 404.
    const parsed = parseFilterSegment(filterSegment);
    if (!parsed.matched) return null;

    const resolved = await resolveActiveCityLocality(citySlug, localitySlug);
    if (!resolved) return null;

    const count = await countApproved(resolved.locality.id, parsed.filter);
    // Thin-page guard (Section 10): < 3 matching listings must 404.
    if (count < THIN_PAGE_MIN) return null;

    const listings = await fetchApprovedCards({
      localityId: resolved.locality.id,
      cityName: resolved.city.name,
      localityName: resolved.locality.name,
      filter: parsed.filter,
    });

    return {
      city: resolved.city,
      locality: {
        id: resolved.locality.id,
        name: resolved.locality.name,
        slug: resolved.locality.slug,
      },
      filter: parsed.filter,
      filterLabel: describeFilter(parsed.filter),
      listings,
      count,
    };
  },
);

export async function generateStaticParams() {
  return getStaticFilterParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/[city]/[locality]/[filter]">): Promise<Metadata> {
  const { city, locality, filter } = await params;
  const data = await load(city, locality, filter);
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };

  return filterMetadata({
    filterLabel: data.filterLabel,
    localityName: data.locality.name,
    cityName: data.city.name,
    citySlug: data.city.slug,
    localitySlug: data.locality.slug,
    filterSegment: filter,
    listingCount: data.count,
  });
}

export default async function FilterPage({
  params,
}: PageProps<"/[city]/[locality]/[filter]">) {
  const { city, locality, filter } = await params;
  const data = await load(city, locality, filter);
  if (!data) notFound();

  const jsonld = [
    breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: data.city.name, url: `/${data.city.slug}` },
      { name: data.locality.name, url: `/${data.city.slug}/${data.locality.slug}` },
      {
        name: data.filterLabel,
        url: `/${data.city.slug}/${data.locality.slug}/${filter}`,
      },
    ]),
    itemListJsonLd(
      data.listings.map((l) => ({ url: `/property/${l.slug}`, name: l.title })),
    ),
  ];

  return (
    <>
      <JsonLd data={jsonld} />

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/${data.city.slug}`} className="hover:text-foreground">
            {data.city.name}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/${data.city.slug}/${data.locality.slug}`}
            className="hover:text-foreground"
          >
            {data.locality.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{data.filterLabel}</span>
        </nav>

        <header className="mb-5">
          <h1 className="text-display-sm">
            {data.filterLabel} in {data.locality.name}, {data.city.name}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 text-clay-500" />
            {data.count} verified {data.count === 1 ? "listing" : "listings"}
          </p>
        </header>

        <div className="mb-6">
          <LocalityFilters
            citySlug={data.city.slug}
            localitySlug={data.locality.slug}
            active={data.filter}
          />
        </div>

        <ListingGrid listings={data.listings} />

        <div className="mt-8">
          <Link
            href={`/${data.city.slug}/${data.locality.slug}`}
            className="text-sm font-medium text-ink-700 hover:underline"
          >
            ← All property in {data.locality.name}
          </Link>
        </div>
      </div>
    </>
  );
}
