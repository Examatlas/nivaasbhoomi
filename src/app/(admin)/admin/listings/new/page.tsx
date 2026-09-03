import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "@/components/admin/listing-form";

export const metadata: Metadata = {
  title: "New Listing",
  robots: { index: false, follow: false },
};

export default function AdminNewListingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/listings"
        className="mb-4 inline-flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to listings
      </Link>
      <h1 className="mb-6 text-display-sm">New listing</h1>
      <ListingForm />
    </div>
  );
}
