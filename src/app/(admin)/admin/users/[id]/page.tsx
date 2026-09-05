import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getBuyerDetail } from "@/lib/admin/users";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin — Buyer" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "clay"> = {
  new: "neutral",
  assigned: "clay",
  contacted: "warning",
  "site-visit-scheduled": "warning",
  "site-visit-done": "warning",
  converted: "success",
  lost: "danger",
  unmatched: "danger",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminBuyerDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const buyer = await getBuyerDetail(id);
  if (!buyer) notFound();

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <Link
        href="/admin/users?tab=buyers"
        className="mb-4 inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to users
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-display-sm">{buyer.name}</h1>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-sm font-semibold text-ink-800">
          Buyer
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* Profile */}
        <section className="h-fit rounded-card border border-border bg-surface p-5 text-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink-950">Profile</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="text-right font-medium text-ink-950 break-all">{buyer.email}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right font-medium text-ink-950">+{buyer.phone}</dd>
            <dt className="text-muted-foreground">Signed up</dt>
            <dd className="text-right font-medium text-ink-950">{fmtDate(buyer.createdAt)}</dd>
            <dt className="text-muted-foreground">Last login</dt>
            <dd className="text-right font-medium text-ink-950">
              {buyer.lastLoginAt ? fmtDate(buyer.lastLoginAt) : "—"}
            </dd>
            <dt className="text-muted-foreground">Enquiries</dt>
            <dd className="text-right font-medium text-ink-950">{buyer.enquiries.length}</dd>
          </dl>
        </section>

        {/* Activity */}
        <section className="rounded-card border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-950">
            Enquiries ({buyer.enquiries.length})
          </h2>
          {buyer.enquiries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              This buyer hasn&apos;t made any enquiries yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {buyer.enquiries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    {e.listingTitle ? (
                      e.listingSlug ? (
                        <Link
                          href={`/property/${e.listingSlug}`}
                          className="font-medium text-ink-950 hover:underline"
                        >
                          {e.listingTitle}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink-950">{e.listingTitle}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">General enquiry</span>
                    )}
                    <div className="text-meta text-muted-foreground">
                      {fmtDate(e.createdAt)} · {e.source}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[e.status] ?? "neutral"} size="sm">
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
