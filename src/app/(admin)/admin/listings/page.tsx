import type { Metadata } from "next";

import { ListingBrowser } from "@/components/admin/listing-browser";
import { SeedBulkDelete } from "@/components/admin/seed-bulk-delete";
import { getSeedCityCounts } from "@/lib/listings/seed-admin";

export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
  const seedCities = await getSeedCityCounts();

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-display-sm">Listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, review and approve property listings. Seed (display-only) listings never take
          leads and don&apos;t count toward city activation.
        </p>
      </header>
      <div className="mb-4">
        <SeedBulkDelete cities={seedCities} />
      </div>
      <ListingBrowser />
    </div>
  );
}
