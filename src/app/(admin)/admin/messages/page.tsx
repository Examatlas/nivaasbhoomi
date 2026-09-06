import type { Metadata } from "next";

import { AdminMessagesList } from "@/components/admin/admin-messages-list";

export const metadata: Metadata = { title: "Admin — Messages" };
export const dynamic = "force-dynamic";

export default function AdminMessagesPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Contact messages</h1>
        <p className="mt-1 text-muted-foreground">Submissions from the public contact form.</p>
      </div>
      <AdminMessagesList />
    </div>
  );
}
