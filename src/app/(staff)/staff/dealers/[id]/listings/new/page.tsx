import type { Metadata } from "next";
import { redirect } from "next/navigation";
import mongoose from "mongoose";

import { getMyStaff } from "@/lib/staff/account";
import { staffCanAccessDealer } from "@/lib/staff/scope";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { StaffShell } from "@/components/staff/staff-shell";
import { ListingWizard, type ListingWizardConfig } from "@/components/dealer/listing-wizard";

export const metadata: Metadata = {
  title: "Publish a listing",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffNewListingPage({
  params,
}: PageProps<"/staff/dealers/[id]/listings/new">) {
  const staff = await getMyStaff();
  if (!staff) redirect("/staff/login");
  const { id } = await params;

  // Scope is enforced server-side: a staff can only create a listing for a
  // dealer in their scope. Out-of-scope (or bad) id → bounce to the dealer page,
  // which shows the request-access flow. Never leak the dealer's existence here.
  if (!mongoose.Types.ObjectId.isValid(id) || !(await staffCanAccessDealer(staff.staffId, id))) {
    redirect(`/staff/dealers/${id}`);
  }

  await connectDB();
  const dealer = await Dealer.findById(id, { businessName: 1, verificationTier: 1 }).lean();
  if (!dealer) redirect("/staff");
  const tier = dealer.verificationTier ?? 0;

  const config: ListingWizardConfig = {
    createEndpoint: "/api/staff/listings",
    extraPayload: { dealerId: id },
    supportsDraft: false,
    doneHref: `/staff/dealers/${id}`,
    submitLabel: "Publish listing",
    reviewNote:
      "Review the essentials. On publish, this listing goes live immediately for this dealer — there is no admin approval step.",
    reviewReadyNote: "Everything looks good — you can publish this listing now.",
  };

  return (
    <StaffShell name={staff.name}>
      <div className="mb-6">
        <h1 className="text-display-sm">Publish a listing</h1>
        <p className="mt-1 text-muted-foreground">
          For <span className="font-medium text-ink-950">{dealer.businessName}</span>. This
          listing goes live immediately once you publish.
        </p>
      </div>
      {tier < 1 ? (
        <div className="rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          This dealer is not yet verified (Tier 0). Verify at least one document before
          publishing — the server will reject a publish until the dealer is Tier 1+.
        </div>
      ) : (
        <ListingWizard config={config} />
      )}
    </StaffShell>
  );
}
