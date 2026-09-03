import { Search, ShieldCheck, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListingGrid } from "@/components/public/listing-grid";
import { getFeaturedListings } from "@/lib/listings/query";

export const revalidate = 3600; // ISR - featured listings change slowly

/**
 * Home. The featured grid renders REAL approved listings from the DB (so every
 * card links to a live property page), newest first. Empty until listings are
 * approved. The city selector search is wired in a later step.
 */
export default async function HomePage() {
  const featured = await getFeaturedListings(8);

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

            {/* Search entry (wired to the location system next). */}
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
    </>
  );
}
