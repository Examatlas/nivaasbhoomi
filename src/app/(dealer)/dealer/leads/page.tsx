import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, Home, MapPin, Wallet, Clock, Banknote, Star } from "lucide-react";

import { getMyLeads, LEAD_STATUSES, type DealerLeadRow } from "@/lib/leads/dealer-leads";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { LeadStatusEditor } from "@/components/dealer/lead-status-editor";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "My Leads",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "ink" | "clay"> = {
  assigned: "clay",
  contacted: "ink",
  "site-visit-scheduled": "warning",
  "site-visit-done": "warning",
  converted: "success",
  lost: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  assigned: "New",
  contacted: "Contacted",
  "site-visit-scheduled": "Visit scheduled",
  "site-visit-done": "Visit done",
  converted: "Converted",
  lost: "Lost",
};

export default async function DealerLeadsPage({
  searchParams,
}: PageProps<"/dealer/leads">) {
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;
  const page = Number(typeof sp.page === "string" ? sp.page : "1") || 1;

  const result = await getMyLeads({ status: statusFilter, page });
  if (!result) redirect("/dealer/login");

  return (
    <DealerShell active="/dealer/leads">
      <div className="mb-6">
        <h1 className="text-display-sm">My leads</h1>
        <p className="mt-1 text-muted-foreground">
          {result.total} lead{result.total === 1 ? "" : "s"} assigned to you. These are
          private to you.
        </p>
      </div>

      {/* Status filter */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <FilterChip label="All" href="/dealer/leads" active={!statusFilter} />
        {LEAD_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_LABEL[s] ?? s}
            href={`/dealer/leads?status=${s}`}
            active={statusFilter === s}
          />
        ))}
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface px-4 py-16 text-center text-muted-foreground">
          No leads {statusFilter ? "in this status" : "yet"}. New enquiries are routed to
          you automatically once you&apos;re verified.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.rows.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <Pagination page={result.page} pageCount={result.pageCount} status={statusFilter} />
      )}
    </DealerShell>
  );
}

function LeadCard({ lead: l }: { lead: DealerLeadRow }) {
  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-950">{l.buyerName}</h3>
            <Badge tone={STATUS_TONE[l.status] ?? "neutral"} size="sm">
              {STATUS_LABEL[l.status] ?? l.status}
            </Badge>
            {l.qualificationScore != null && (
              <span className="inline-flex items-center gap-1 text-meta text-clay-700">
                <Star className="size-3.5 fill-clay-400 text-clay-400" /> {l.qualificationScore}
              </span>
            )}
          </div>
          <a
            href={`tel:+${l.phone}`}
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-wa-700 hover:underline"
          >
            <Phone className="size-4" /> +{l.phone}
          </a>
        </div>
        {l.assignedAt && (
          <span className="text-meta text-muted-foreground">
            {new Date(l.assignedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {l.listing ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-meta text-muted-foreground">
          <Home className="size-3.5 text-clay-500" /> Enquired about:{" "}
          <span className="font-medium text-ink-800">{l.listing.title}</span>
        </p>
      ) : l.source === "agent_profile" ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-meta text-clay-700">
          <Home className="size-3.5" /> Contacted you via your{" "}
          <span className="font-medium">public profile</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground">
        {(l.localityName || l.cityName) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-clay-500" />
            {[l.localityName, l.cityName].filter(Boolean).join(", ")}
          </span>
        )}
        {(l.bhk || l.propertyType) && (
          <span className="inline-flex items-center gap-1">
            <Home className="size-3.5" />
            {[l.bhk ? `${l.bhk} BHK` : null, l.propertyType].filter(Boolean).join(" ")}
          </span>
        )}
        {l.budget && (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3.5" /> {l.budget}
          </span>
        )}
        {l.timeline && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {l.timeline}
          </span>
        )}
        {l.loanRequired != null && (
          <span className="inline-flex items-center gap-1">
            <Banknote className="size-3.5" /> Loan: {l.loanRequired ? "yes" : "no"}
          </span>
        )}
      </div>

      <LeadStatusEditor leadId={l.id} status={l.status} notes={l.dealerNotes} />
    </li>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1 text-meta font-medium transition-colors " +
        (active
          ? "bg-ink-900 text-primary-foreground"
          : "bg-surface-muted text-muted-foreground hover:bg-sand-200")
      }
    >
      {label}
    </Link>
  );
}

function Pagination({
  page,
  pageCount,
  status,
}: {
  page: number;
  pageCount: number;
  status?: string;
}) {
  const q = (p: number) =>
    `/dealer/leads?${status ? `status=${status}&` : ""}page=${p}`;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={q(page - 1)} className="rounded-control border border-border px-3 py-1.5 hover:bg-surface-muted">
          Previous
        </Link>
      ) : (
        <span className="rounded-control border border-border px-3 py-1.5 text-muted-foreground opacity-50">
          Previous
        </span>
      )}
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={q(page + 1)} className="rounded-control border border-border px-3 py-1.5 hover:bg-surface-muted">
          Next
        </Link>
      ) : (
        <span className="rounded-control border border-border px-3 py-1.5 text-muted-foreground opacity-50">
          Next
        </span>
      )}
    </div>
  );
}
