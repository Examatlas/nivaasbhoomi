import type { Metadata } from "next";

import { AdminStaffManager } from "@/components/admin/admin-staff-manager";

export const metadata: Metadata = { title: "Admin — Staff" };
export const dynamic = "force-dynamic";

export default function AdminStaffPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Staff</h1>
        <p className="mt-1 text-muted-foreground">
          Staff accounts onboard dealers, verify them, and publish listings — but only for
          the dealers they own or were granted. Deactivating an account ends its sessions
          immediately.
        </p>
      </div>
      <AdminStaffManager />
    </div>
  );
}
