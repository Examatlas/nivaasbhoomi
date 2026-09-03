import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getMyDealer } from "@/lib/dealers/account";
import { getMyListingForEdit } from "@/lib/listings/dealer";
import { DealerShell } from "@/components/dealer/dealer-shell";
import {
  ListingWizard,
  type ListingWizardInitial,
} from "@/components/dealer/listing-wizard";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: PageProps<"/dealer/listings/[id]/edit">) {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");

  const { id } = await params;
  // Owner-scoped: null when the listing isn't this dealer's (no ownership leak).
  const listing = await getMyListingForEdit(id);
  if (!listing) notFound();

  return (
    <DealerShell active="/dealer/listings">
      <div className="mb-6">
        <h1 className="text-display-sm">Edit listing</h1>
      </div>
      <ListingWizard initial={listing as ListingWizardInitial} />
    </DealerShell>
  );
}
