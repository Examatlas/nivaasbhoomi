import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyStaff } from "@/lib/staff/account";
import { StaffShell } from "@/components/staff/staff-shell";
import { StaffDealerDetail } from "@/components/staff/staff-dealer-detail";

export const metadata: Metadata = {
  title: "Dealer",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffDealerPage({ params }: PageProps<"/staff/dealers/[id]">) {
  const staff = await getMyStaff();
  if (!staff) redirect("/staff/login");
  const { id } = await params;

  return (
    <StaffShell name={staff.name}>
      <StaffDealerDetail id={id} />
    </StaffShell>
  );
}
