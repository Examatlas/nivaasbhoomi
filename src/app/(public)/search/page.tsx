import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search as SearchIcon, MapPin, Building2 } from "lucide-react";

import { search } from "@/lib/search/query";
import { BRAND } from "@/lib/seo/site";
import { ListingGrid } from "@/components/public/listing-grid";

// Search results are per-query and must never be indexed (Section 10: avoid
// indexing infinite query URLs). Rendered dynamically from the query string.
export const metadata: Metadata = {
  title: `Search property | ${BRAND}`,
  robots: { index: false, follow: true },
};

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const results = await search(q);

  // A strong city/locality match routes straight to that page.
  if (results.redirect) redirect(results.redirect);

  const hasAny =
    results.cities.length + results.localities.length + results.listings.length > 0;

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <h1 className="text-display-sm">Search</h1>

      {/* Plain GET form - works without JS, no client bundle. */}
      <form action="/search" method="get" className="mt-4 max-w-xl">
        <div className="flex items-center gap-2 rounded-sheet border border-border bg-surface p-2">
          <SearchIcon className="ml-2 size-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="City, locality or keyword…"
            className="w-full bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-subtle-foreground"
            aria-label="Search property"
          />
          <button
            type="submit"
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Search
          </button>
        </div>
      </form>

      {q && (
        <p className="mt-4 text-sm text-muted-foreground">
          Results for <span className="font-medium text-foreground">“{q}”</span>
        </p>
      )}

      {q && !hasAny && (
        <p className="mt-8 rounded-card border border-border bg-surface px-4 py-12 text-center text-muted-foreground">
          Nothing found for “{q}”. Try a city or locality name, or a property type like
          “flats”.
        </p>
      )}

      {/* City + locality matches */}
      {(results.cities.length > 0 || results.localities.length > 0) && (
        <section className="mt-6">
          <div className="flex flex-wrap gap-2">
            {results.cities.map((c) => (
              <Link
                key={`c-${c.slug}`}
                href={`/${c.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-surface-muted"
              >
                <Building2 className="size-4 text-clay-500" /> {c.name}
              </Link>
            ))}
            {results.localities.map((l) => (
              <Link
                key={`l-${l.citySlug}-${l.slug}`}
                href={`/${l.citySlug}/${l.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-surface-muted"
              >
                <MapPin className="size-4 text-clay-500" /> {l.name}, {l.cityName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Listing matches */}
      {results.listings.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-ink-950">
            {results.listings.length} matching {results.listings.length === 1 ? "property" : "properties"}
          </h2>
          <ListingGrid listings={results.listings} />
        </section>
      )}

      {!q && (
        <p className="mt-8 text-muted-foreground">
          Search verified property across live cities - type a city, a locality, or a
          keyword.
        </p>
      )}
    </div>
  );
}
