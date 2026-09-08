import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";

import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { SavedListing } from "@/lib/db/models/SavedListing";
import { getListingsByIds } from "@/lib/listings/query";
import { ListingGrid } from "@/components/public/listing-grid";

export const metadata: Metadata = {
  title: "Saved properties",
  robots: { index: false, follow: false },
};
// Per-buyer content — never static.
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getUserSession();
  if (!session) redirect("/login?next=/saved");

  await connectDB();
  // Newest-saved first; a listing that later expired/was removed simply drops
  // out (getListingsByIds only returns approved listings).
  const rows = await SavedListing.find(
    { userId: session.userId },
    { listingId: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();
  const ids = rows.map((r) => String(r.listingId));
  const listings = await getListingsByIds(ids);

  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-display-sm">Saved properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The listings you&apos;ve shortlisted. Tap the heart on any listing to add or remove it.
        </p>
      </header>

      {listings.length > 0 ? (
        <ListingGrid listings={listings} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-clay-50 text-clay-600">
            <Heart className="size-6" />
          </span>
          <p className="text-base font-medium text-ink-950">No saved properties yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Browse listings and tap the heart to shortlist the ones you like — they&apos;ll show up here.
          </p>
          <Link
            href="/search"
            className="mt-1 inline-flex rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Browse listings
          </Link>
        </div>
      )}
    </div>
  );
}
