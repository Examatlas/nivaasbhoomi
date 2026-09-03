import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Lock } from "lucide-react";

import { getMyDealer, tierLadder, tierName } from "@/lib/dealers/account";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { DocumentUploader } from "@/components/dealer/document-uploader";
import { VerificationBadge } from "@/components/public/verification-badge";

export const metadata: Metadata = {
  title: "Verification",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerVerificationPage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");

  const ladder = tierLadder(dealer);

  return (
    <DealerShell active="/dealer/verification">
      <div className="mb-6">
        <h1 className="text-display-sm">Verification</h1>
        <p className="mt-1 text-muted-foreground">
          Upload your documents. Our team verifies them, and your tier updates
          automatically. Higher tiers build buyer trust and rank listings better.
        </p>
      </div>

      {/* Current tier */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-5">
        <div>
          <p className="text-meta text-muted-foreground">Current tier</p>
          <div className="mt-1 flex items-center gap-2">
            {dealer.verificationTier >= 1 ? (
              <VerificationBadge tier={dealer.verificationTier} size="sm" />
            ) : (
              <span className="text-price text-ink-950">Tier 0</span>
            )}
            <span className="text-sm text-muted-foreground">
              {tierName(dealer.verificationTier)}
            </span>
          </div>
        </div>
        {dealer.verificationTier === 0 && (
          <p className="text-meta text-clay-800">
            Listings stay hidden until you reach Tier 1 (PAN + Aadhaar verified).
          </p>
        )}
      </div>

      {/* Tier ladder */}
      <h2 className="mb-3 text-sm font-semibold text-ink-950">Tier ladder</h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ladder.map((rung) => (
          <div
            key={rung.tier}
            className={
              "rounded-card border p-4 " +
              (rung.reached
                ? "border-success-100 bg-success-50"
                : rung.isNext
                  ? "border-clay-200 bg-clay-50"
                  : "border-border bg-surface")
            }
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-950">Tier {rung.tier}</span>
              {rung.reached ? (
                <Check className="size-4 text-success-700" />
              ) : (
                <Lock className="size-4 text-sand-400" />
              )}
            </div>
            <p className="text-meta text-muted-foreground">{rung.label}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {rung.requirements.map((req) => (
                <li key={req.label} className="flex items-center gap-1.5 text-meta">
                  <span
                    className={
                      "inline-block size-1.5 rounded-full " +
                      (req.met ? "bg-success-600" : "bg-sand-300")
                    }
                  />
                  <span className={req.met ? "text-muted-foreground" : "text-foreground"}>
                    {req.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Documents */}
      <h2 className="mb-3 text-sm font-semibold text-ink-950">Your documents</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {dealer.documents.map((doc) => (
          <DocumentUploader key={doc.key} dealerId={dealer.id} doc={doc} />
        ))}
      </div>
    </DealerShell>
  );
}
