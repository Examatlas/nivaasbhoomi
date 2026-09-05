import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyDealer } from "@/lib/dealers/account";
import { Logo } from "@/components/shared/logo";
import { DealerProfileForm } from "@/components/dealer/dealer-profile-form";

export const metadata: Metadata = {
  title: "Set up your dealer profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerOnboardingPage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");
  // Already onboarded -> straight to the dashboard.
  if (dealer.profileComplete) redirect("/dealer/dashboard");

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo href="/" />
        <div>
          <h1 className="text-display-sm">Welcome — let&apos;s set you up</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell buyers who you are and where you work. You can add documents for
            verification next. You start at Tier 0: you can create listings, but they go
            live only after verification.
          </p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <DealerProfileForm dealer={dealer} mode="onboarding" />
      </div>
    </div>
  );
}
