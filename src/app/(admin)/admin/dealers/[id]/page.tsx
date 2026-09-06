import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getDealerVerification } from "@/lib/dealers/admin";
import { getDealerActivity } from "@/lib/admin/users";
import { AdminVerifyPanel } from "@/components/admin/admin-verify-panel";
import { AdminDealerEditor } from "@/components/admin/admin-dealer-editor";
import { sanitizeAbout } from "@/lib/security/sanitize";
import { SITE_URL } from "@/lib/seo/site";
import { Badge } from "@/components/ui/badge";

const DEAL_LABELS: Record<string, string> = {
  plot: "Plots",
  flat: "Flats",
  house: "Houses",
  commercial: "Commercial",
  rent: "Rentals",
  resale: "Resale",
};

export const metadata: Metadata = { title: "Admin — Verify Dealer" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  banned: "danger",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminDealerVerifyPage({ params }: PageProps<"/admin/dealers/[id]">) {
  const { id } = await params;
  const [dealer, activity] = await Promise.all([
    getDealerVerification(id),
    getDealerActivity(id),
  ]);
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
              <dt className="text-muted-foreground">Zenith Code</dt>
              <dd className="text-right font-medium text-ink-950">
                {dealer.zenithConnected ? "Connected" : "Not connected"}
              </dd>
              {dealer.zenithNumber && (
                <>
                  <dt className="text-muted-foreground">Zenith number</dt>
                  <dd className="text-right font-medium text-ink-950">+{dealer.zenithNumber}</dd>
                </>
              )}
              {dealer.zenithOrgId && (
                <>
                  <dt className="text-muted-foreground">Zenith org id</dt>
                  <dd className="text-right font-mono text-meta text-ink-950 break-all">
                    {dealer.zenithOrgId}
                  </dd>
                </>
              )}
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

      {/* Public profile (read view) + slug history */}
      <section className="mt-6 rounded-card border border-border bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-950">Public profile</h2>
          {dealer.profile.slug && (
            <a
              href={`${SITE_URL}/agent/${dealer.profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-meta text-clay-600 hover:underline"
            >
              {SITE_URL}/agent/{dealer.profile.slug} ↗
            </a>
          )}
        </div>

        {dealer.profile.tagline && (
          <p className="text-sm text-ink-800">{dealer.profile.tagline}</p>
        )}

        {dealer.profile.dealTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dealer.profile.dealTypes.map((d) => (
              <span key={d} className="rounded-full bg-ink-50 px-2.5 py-0.5 text-meta text-ink-800">
                {DEAL_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        )}

        {dealer.profile.about ? (
          <div
            className="prose-about mt-3 max-w-none text-sm text-ink-800 [&_a]:text-clay-600 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeAbout(dealer.profile.about) }}
          />
        ) : (
          <p className="mt-3 text-meta text-muted-foreground">No about text yet.</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
          {dealer.profile.officeAddress && (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-meta text-muted-foreground">Office</dt>
              <dd className="text-ink-950">{dealer.profile.officeAddress}</dd>
            </div>
          )}
          <div>
            <dt className="text-meta text-muted-foreground">Public email</dt>
            <dd className="text-ink-950">
              {dealer.profile.publicEmailOptIn && dealer.profile.publicEmail
                ? dealer.profile.publicEmail
                : "Hidden"}
            </dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Public phone</dt>
            <dd className="text-ink-950">{dealer.profile.publicPhoneOptIn ? "Shown" : "Hidden"}</dd>
          </div>
          {dealer.profile.reraNumber && (
            <div>
              <dt className="text-meta text-muted-foreground">RERA</dt>
              <dd className="text-ink-950">{dealer.profile.reraNumber}</dd>
            </div>
          )}
          {dealer.profile.gstNumber && (
            <div>
              <dt className="text-meta text-muted-foreground">GST</dt>
              <dd className="text-ink-950">{dealer.profile.gstNumber}</dd>
            </div>
          )}
        </dl>

        {dealer.slugHistory.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-meta font-semibold text-muted-foreground">Link history</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {dealer.slugHistory.map((s, i) => (
                <li
                  key={s}
                  className={
                    "rounded-full px-2.5 py-0.5 text-meta " +
                    (i === 0
                      ? "bg-success-50 font-medium text-success-700"
                      : "bg-ink-50 text-muted-foreground line-through")
                  }
                >
                  /agent/{s}
                  {i === 0 ? " (current)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Force-edit (admin override) */}
      <section className="mt-6 rounded-card border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-950">Force-edit</h2>
        <AdminDealerEditor dealer={dealer} />
      </section>

      {activity && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-950">
              Listings ({activity.totalListings})
            </h2>
            {activity.listings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No listings yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {activity.listings.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate font-medium text-ink-950">
                      {l.slug ? (
                        <Link href={`/property/${l.slug}`} className="hover:underline">
                          {l.title}
                        </Link>
                      ) : (
                        l.title
                      )}
                    </span>
                    <span className="shrink-0 text-meta text-muted-foreground">
                      {l.status} · {fmtDate(l.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-950">
              Leads ({activity.totalLeads})
            </h2>
            {activity.leads.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {activity.leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="font-medium text-ink-950">{l.name}</span>{" "}
                      <span className="text-meta text-muted-foreground">+{l.phone}</span>
                    </span>
                    <span className="shrink-0 text-meta text-muted-foreground">
                      {l.status} · {fmtDate(l.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
