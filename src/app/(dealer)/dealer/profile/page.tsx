import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyDealer } from "@/lib/dealers/account";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { DealerProfileForm } from "@/components/dealer/dealer-profile-form";

export const metadata: Metadata = {
  title: "Coverage & Profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerProfilePage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");

  return (
    <DealerShell active="/dealer/profile">
      <div className="mb-6">
        <h1 className="text-display-sm">Coverage & profile</h1>
        <p className="mt-1 text-muted-foreground">
          Keep your details and the areas you serve up to date.
        </p>
      </div>
      <div className="max-w-3xl">
        <DealerProfileForm dealer={dealer} mode="edit" />
      </div>
    </DealerShell>
  );
}
