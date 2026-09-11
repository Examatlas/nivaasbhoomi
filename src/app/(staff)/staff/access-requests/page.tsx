import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyStaff } from "@/lib/staff/account";
import { StaffShell } from "@/components/staff/staff-shell";
import { StaffAccessRequests } from "@/components/staff/staff-access-requests";

export const metadata: Metadata = {
  title: "Access requests",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffAccessRequestsPage() {
  const staff = await getMyStaff();
  if (!staff) redirect("/staff/login");

  return (
    <StaffShell active="/staff/access-requests" name={staff.name}>
      <div className="mb-6">
        <h1 className="text-display-sm">Access requests</h1>
        <p className="mt-1 text-muted-foreground">
          Requests you&apos;ve made to access dealers you didn&apos;t onboard. An admin
          reviews each one; once approved, the dealer appears in your list.
        </p>
      </div>
      <StaffAccessRequests />
    </StaffShell>
  );
}
