import type { Metadata } from "next";
import { ListingReview } from "@/components/admin/listing-review";

export const metadata: Metadata = {
  title: "Listing Review",
  robots: { index: false, follow: false },
};

export default async function AdminListingDetailPage({
  params,
}: PageProps<"/admin/listings/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <ListingReview id={id} />
    </div>
  );
}
