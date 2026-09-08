"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BellPlus } from "lucide-react";

import { PropertyCard } from "@/components/public/property-card";
import { SaveAlertButton } from "@/components/alerts/save-alert-button";
import { useCity } from "@/components/public/city/city-provider";
import type { HomeCity } from "@/lib/listings/home";

/**
 * City-aware home sections (client island so the page stays static/ISR):
 *   • "Properties in <city>" — the resolved city's newest listings, or an
 *     honest empty state when it has none yet.
 *   • "Browse by city" — horizontal-scroll tabs across the other live cities.
 * All data is embedded from the server; this only picks which slice to show.
 */
export function HomeExperience({ cities }: { cities: HomeCity[] }) {
  const { resolution } = useCity();
  if (cities.length === 0) return null;

  const current = cities.find((c) => c.slug === resolution?.city.slug) ?? cities[0]!;
  const nearestWithListings = cities.find(
    (c) => c.slug !== current.slug && c.listings.length > 0,
  );

  return (
    <>
      {/* ---------- 2. Properties in <city> ---------- */}
      <section className="mx-auto max-w-page px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-display-sm">Properties in {current.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Newest listings near you. See the full details on every one.
            </p>
          </div>
          {current.listings.length > 0 && (
            <Link
              href={`/${current.slug}`}
              className="group hidden shrink-0 items-center gap-1 text-sm font-medium text-clay-700 hover:text-clay-800 sm:inline-flex"
            >
              See all in {current.name}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>

        {current.listings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {current.listings.slice(0, 6).map((l, i) => (
                <PropertyCard key={l.id} listing={l} priority={i < 2} />
              ))}
            </div>
            <div className="mt-6 sm:hidden">
              <Link
                href={`/${current.slug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-clay-700"
              >
                See all in {current.name}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </>
        ) : (
          <EmptyCity
            cityId={current.id}
            cityName={current.name}
            nearest={nearestWithListings ?? null}
          />
        )}
      </section>

      {/* ---------- 3. Browse by city ---------- */}
      {cities.length > 1 && <BrowseByCity cities={cities} initialSlug={current.slug} />}
    </>
  );
}

function EmptyCity({
  cityId,
  cityName,
  nearest,
}: {
  cityId: string;
  cityName: string;
  nearest: HomeCity | null;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-card border border-border bg-surface-muted/50 p-8 text-center">
      <h3 className="text-lg font-semibold text-ink-950">Nothing in {cityName} yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        We&apos;re new in this city. Tell us where you&apos;re looking and we&apos;ll message you
        on WhatsApp the day the first listing lands.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <SaveAlertButton
          criteria={{ cityId, localityIds: [], purpose: "buy" }}
          label="Get an alert"
        />
        {nearest && (
          <Link
            href={`/${nearest.slug}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted"
          >
            Browse {nearest.name} instead
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function BrowseByCity({ cities, initialSlug }: { cities: HomeCity[]; initialSlug: string }) {
  const [active, setActive] = useState(
    cities.some((c) => c.slug === initialSlug) ? initialSlug : cities[0]!.slug,
  );
  const city = cities.find((c) => c.slug === active) ?? cities[0]!;

  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
        <h2 className="text-display-sm">Browse by city</h2>

        {/* Horizontal-scroll tabs (mobile-friendly). */}
        <div className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {cities.map((c) => {
              const on = c.slug === active;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setActive(c.slug)}
                  aria-pressed={on}
                  className={
                    on
                      ? "shrink-0 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white"
                      : "shrink-0 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink-700 hover:bg-surface-muted"
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          {city.listings.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {city.listings.slice(0, 4).map((l) => (
                <PropertyCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No listings in {city.name} yet.</p>
          )}
          <div className="mt-6">
            <Link
              href={`/${city.slug}`}
              className="group inline-flex items-center gap-1 text-sm font-medium text-clay-700 hover:text-clay-800"
            >
              See all in {city.name}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
