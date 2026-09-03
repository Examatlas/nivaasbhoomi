import Link from "next/link";
import { Search, ShieldCheck, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyCard } from "@/components/public/property-card";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";

/**
 * Home. Phase 0 renders a real hero and a featured grid off sample data so the
 * layout can be reviewed; the city selector and live featured listings arrive
 * with the location system (P1) and public site (P3).
 */
export default function HomePage() {
  return (
    <>
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

            {/* Search entry (wired to the location system in P1). */}
            <div className="mt-8 flex w-full max-w-xl flex-col gap-2 rounded-sheet border border-border bg-surface p-2 shadow-card sm:flex-row">
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <span className="py-3 text-sm text-subtle-foreground">
                  Search city, locality or project…
                </span>
              </div>
              <Button size="lg" className="sm:w-auto">
                Search
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-meta text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-ink-600" />
                Verified dealers only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-4 text-wa-600" />
                Direct WhatsApp contact
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Featured ---------- */}
      <section className="mx-auto max-w-page px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-display-sm">Featured in Ranchi</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hand-picked, freshly verified listings.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/">View all</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SAMPLE_LISTINGS.map((listing, i) => (
            <PropertyCard key={listing.id} listing={listing} priority={i < 2} />
          ))}
        </div>
      </section>
    </>
  );
}
