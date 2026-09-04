import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getDealerVerification } from "@/lib/dealers/admin";
import { AdminVerifyPanel } from "@/components/admin/admin-verify-panel";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin — Verify Dealer" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  banned: "danger",
};

export default async function AdminDealerVerifyPage({ params }: PageProps<"/admin/dealers/[id]">) {
  const { id } = await params;
  const dealer = await getDealerVerification(id);
  if (!dealer) notFound();

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <Link href="/admin/dealers" className="mb-4 inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to dealers
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-display-sm">{dealer.businessName}</h1>
        <Badge tone={STATUS_TONE[dealer.status] ?? "warning"} size="sm">{dealer.status}</Badge>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-sm font-semibold text-ink-800">
          Tier {dealer.tier} · {dealer.tierLabel}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-950">Documents</h2>
          <AdminVerifyPanel
            dealerId={dealer.id}
            documents={dealer.documents}
            tierOverride={dealer.tierOverride}
            notes={dealer.verificationNotes}
          />
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-card border border-border bg-surface p-5 text-sm">
            <h2 className="mb-3 text-sm font-semibold text-ink-950">Dealer</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-right font-medium text-ink-950">{dealer.name}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-right font-medium text-ink-950">+{dealer.phone}</dd>
              {dealer.email && (<><dt className="text-muted-foreground">Email</dt><dd className="text-right font-medium text-ink-950">{dealer.email}</dd></>)}
              <dt className="text-muted-foreground">Live listings</dt>
              <dd className="text-right font-medium text-ink-950">{dealer.liveListings}</dd>
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="text-right font-medium text-ink-950">
                {dealer.ratingCount > 0 ? `★ ${dealer.rating} (${dealer.ratingCount})` : "—"}
              </dd>
              <dt className="text-muted-foreground">Avg response</dt>
              <dd className="text-right font-medium text-ink-950">
                {dealer.avgResponseMinutes != null ? `~${dealer.avgResponseMinutes} min` : "—"}
              </dd>
              {dealer.tierOverride != null && (
                <>
                  <dt className="text-muted-foreground">Tier cap</dt>
                  <dd className="text-right font-medium text-warning-700">at {dealer.tierOverride}</dd>
                </>
              )}
            </dl>
          </section>

          {dealer.status === "paused" && (
            <div className="rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-meta text-warning-700">
              This dealer is paused (auto-paused for a low rating, or set by an admin) and
              receives no new leads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
