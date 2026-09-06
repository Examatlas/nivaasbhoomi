import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyDealer, profileCompleteness } from "@/lib/dealers/account";
import { SITE_URL } from "@/lib/seo/site";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { DealerProfileForm } from "@/components/dealer/dealer-profile-form";
import { AccountDetailsForm } from "@/components/dealer/account-details-form";
import { DealerProfileEditor } from "@/components/dealer/dealer-profile-editor";
import { DealerSlugEditor } from "@/components/dealer/dealer-slug-editor";
import { ProfileCompletenessMeter } from "@/components/dealer/profile-completeness-meter";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerProfilePage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");

  const completeness = profileCompleteness(dealer);

  return (
    <DealerShell active="/dealer/profile">
      <div className="mb-6">
        <h1 className="text-display-sm">Your public profile</h1>
        <p className="mt-1 text-muted-foreground">
          This is your public dealer page buyers see. A complete, verified profile appears in
          search.
        </p>
      </div>

      <div className="flex max-w-3xl flex-col gap-6">
        <ProfileCompletenessMeter completeness={completeness} />

        <DealerSlugEditor
          dealerId={dealer.id}
          currentSlug={dealer.profile.slug}
          slugLockUntil={dealer.profile.slugLockUntil}
          siteUrl={SITE_URL}
        />

        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink-950">Basics & coverage</h2>
          <DealerProfileForm dealer={dealer} mode="edit" />
        </div>

        <AccountDetailsForm dealer={dealer} />

        <DealerProfileEditor dealer={dealer} />
      </div>
    </DealerShell>
  );
}
