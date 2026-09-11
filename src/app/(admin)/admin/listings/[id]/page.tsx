import type { Metadata } from "next";
import mongoose from "mongoose";

import { ListingReview } from "@/components/admin/listing-review";
import { ListingSeoEditor } from "@/components/admin/listing-seo-editor";
import { SeedToggle } from "@/components/admin/seed-toggle";
import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";

export const metadata: Metadata = {
  title: "Listing Review",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminListingDetailPage({
  params,
}: PageProps<"/admin/listings/[id]">) {
  const { id } = await params;

  let isSeed = false;
  let seedExpiresAt: string | null = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    await connectDB();
    const l = await Listing.findById(id, { isSeed: 1, seedExpiresAt: 1 }).lean();
    isSeed = Boolean(l?.isSeed);
    seedExpiresAt = l?.seedExpiresAt ? new Date(l.seedExpiresAt).toISOString() : null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SeedToggle listingId={id} initialIsSeed={isSeed} initialExpiresAt={seedExpiresAt} />
      <ListingReview id={id} />
      <ListingSeoEditor id={id} />
    </div>
  );
}
