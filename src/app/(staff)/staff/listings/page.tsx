import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyStaff } from "@/lib/staff/account";
import { StaffShell } from "@/components/staff/staff-shell";
import { StaffListings } from "@/components/staff/staff-listings";

export const metadata: Metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffListingsPage() {
  const staff = await getMyStaff();
  if (!staff) redirect("/staff/login");

  return (
    <StaffShell active="/staff/listings" name={staff.name}>
      <div className="mb-6">
        <h1 className="text-display-sm">Listings</h1>
        <p className="mt-1 text-muted-foreground">
          Every listing for the dealers in your scope. Publish new ones from a dealer&apos;s
          page.
        </p>
      </div>
      <StaffListings />
    </StaffShell>
  );
}
