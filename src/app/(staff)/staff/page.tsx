import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyStaff } from "@/lib/staff/account";
import { StaffShell } from "@/components/staff/staff-shell";
import { StaffDealers } from "@/components/staff/staff-dealers";

export const metadata: Metadata = {
  title: "My dealers",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const staff = await getMyStaff();
  if (!staff) redirect("/staff/login");

  return (
    <StaffShell active="/staff" name={staff.name}>
      <div className="mb-6">
        <h1 className="text-display-sm">My dealers</h1>
        <p className="mt-1 text-muted-foreground">
          Dealers you onboarded, plus any you were granted access to. Onboard a new
          dealer, verify their documents, and publish listings for them.
        </p>
      </div>
      <StaffDealers />
    </StaffShell>
  );
}
