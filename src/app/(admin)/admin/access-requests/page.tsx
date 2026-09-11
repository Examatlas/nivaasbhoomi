import type { Metadata } from "next";

import { AdminAccessRequests } from "@/components/admin/admin-access-requests";

export const metadata: Metadata = { title: "Admin — Access requests" };
export const dynamic = "force-dynamic";

export default function AdminAccessRequestsPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Access requests</h1>
        <p className="mt-1 text-muted-foreground">
          Staff requests to access dealers they didn&apos;t onboard. Approving grants the
          staff a scoped view of that dealer.
        </p>
      </div>
      <AdminAccessRequests />
    </div>
  );
}
