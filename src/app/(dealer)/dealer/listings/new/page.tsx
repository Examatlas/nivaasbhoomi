import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyDealer } from "@/lib/dealers/account";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { ListingWizard } from "@/components/dealer/listing-wizard";

export const metadata: Metadata = {
  title: "Add a listing",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");
  if (!dealer.profileComplete) redirect("/dealer/onboarding");

  return (
    <DealerShell active="/dealer/listings/new">
      <div className="mb-6">
        <h1 className="text-display-sm">Add a listing</h1>
        <p className="mt-1 text-muted-foreground">
          Eight quick steps. We save a draft as you go, so you can finish later.
        </p>
      </div>
      {dealer.verificationTier === 0 && (
        <div className="mb-6 rounded-card border border-clay-100 bg-clay-50 px-4 py-3 text-sm text-clay-800">
          You can create and submit listings now, but they go live only after you&apos;re
          verified (Tier 1+).
        </div>
      )}
      <ListingWizard />
    </DealerShell>
  );
}
