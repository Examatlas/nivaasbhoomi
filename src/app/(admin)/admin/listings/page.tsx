import type { Metadata } from "next";
import { ListingBrowser } from "@/components/admin/listing-browser";

export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};

export default function AdminListingsPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-display-sm">Listings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, review and approve property listings.
        </p>
      </header>
      <ListingBrowser />
    </div>
  );
}
