import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, AlertTriangle, ArrowRight } from "lucide-react";

import {
  getUnmatchedByCity,
  getAllLeads,
  getLeadCities,
  getDealerLeadSummary,
  type AdminLeadRow,
} from "@/lib/leads/admin-leads";
import { Badge } from "@/components/ui/badge";
import { LeadReassignAction } from "@/components/admin/lead-reassign-action";

export const metadata: Metadata = { title: "Admin — Leads" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "ink" | "clay"> = {
  new: "neutral",
  assigned: "clay",
  contacted: "ink",
  "site-visit-scheduled": "warning",
  "site-visit-done": "warning",
  converted: "success",
  lost: "danger",
  unmatched: "danger",
  "quota-exceeded": "warning",
};

const ALL_STATUSES = [
  "new", "assigned", "delivered", "contacted", "site-visit-scheduled", "site-visit-done",
  "converted", "lost", "unmatched", "quota-exceeded", "unclaimed",
];
const SOURCES = ["listing", "agent_profile", "whatsapp_click", "generic", "ad"];

export default async function AdminLeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : sp.view === "dealers" ? "dealers" : "queue";

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Leads</h1>
        <p className="mt-1 text-muted-foreground">
          Unmatched leads by city are your sales signal — they show exactly where you need
          dealers.
        </p>
      </div>

      <div className="mb-6 flex gap-1.5">
        <Tab label="Unmatched queue" href="/admin/leads" active={view === "queue"} />
        <Tab label="All leads" href="/admin/leads?view=all" active={view === "all"} />
        <Tab label="Dealer summary" href="/admin/leads?view=dealers" active={view === "dealers"} />
      </div>

      {view === "queue" ? <Queue /> : view === "dealers" ? <DealerSummary /> : <AllLeads sp={sp} />}
    </div>
  );
}

// ---- unmatched-by-city queue ----

async function Queue() {
  const q = await getUnmatchedByCity();

  if (q.totalUnmatched === 0) {
    return (
      <p className="rounded-card border border-border bg-surface px-4 py-16 text-center text-muted-foreground">
        No unmatched or quota-exceeded leads. Every lead is being routed to a dealer. 🎉
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-danger-100 bg-danger-50 px-4 py-3">
        <p className="text-sm font-medium text-danger-700">
          {q.totalUnmatched} unmatched/quota-exceeded lead{q.totalUnmatched === 1 ? "" : "s"}{" "}
          across {q.groups.length} cit{q.groups.length === 1 ? "y" : "ies"}.
        </p>
      </div>

      {q.groups.map((g) => (
        <section key={g.cityId} className="rounded-card border border-border bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-950">
              <MapPin className="size-5 text-clay-600" />
              {g.cityName}
            </h2>
            <span className="rounded-full bg-danger-50 px-3 py-1 text-sm font-bold text-danger-700">
              {g.count} lead{g.count === 1 ? "" : "s"} need a dealer
            </span>
          </header>
          <ul className="divide-y divide-border">
            {g.leads.map((l) => (
              <QueueRow key={l.id} lead={l} />
            ))}
          </ul>
        </section>
      ))}

      {q.ungrouped.length > 0 && (
        <section className="rounded-card border border-border bg-surface">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold text-ink-950">No city resolved</h2>
          </header>
          <ul className="divide-y divide-border">
            {q.ungrouped.map((l) => (
              <QueueRow key={l.id} lead={l} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QueueRow({ lead: l }: { lead: AdminLeadRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink-950">{l.buyerName}</span>
          <Badge tone={STATUS_TONE[l.status] ?? "neutral"} size="sm">
            {l.status}
          </Badge>
          <span className="inline-flex items-center gap-1 text-meta text-warning-700">
            <AlertTriangle className="size-3.5" /> {l.reason}
          </span>
        </div>
        <p className="mt-0.5 text-meta text-muted-foreground">
          +{l.phone}
          {l.budget ? ` · ${l.budget}` : ""}
          {l.bhk ? ` · ${l.bhk} BHK` : ""}
          {l.localityName ? ` · ${l.localityName}` : ""}
          {l.listing ? ` · re: ${l.listing.title}` : ""}
          {l.source === "agent_profile" ? " · via dealer profile" : ""}
        </p>
        {l.otherListings && l.otherListings.length > 0 && (
          <p className="mt-0.5 text-meta text-muted-foreground">
            Also enquired (same dealer): {l.otherListings.map((o) => o.title).join(", ")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LeadReassignAction leadId={l.id} status={l.status} cityId={l.cityId} currentDealerName={l.assignedDealer?.businessName} />
        <Link
          href={`/admin/leads/${l.id}`}
          className="inline-flex items-center gap-1 rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Review <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </li>
  );
}

// ---- all leads (searchable) ----

async function AllLeads({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = s("status");
  const cityId = s("city");
  const source = s("source");
  const from = s("from");
  const to = s("to");
  const notViewed = sp.notViewed === "1";
  const q = s("q");
  const page = Number(s("page") ?? "1") || 1;

  const [result, cities] = await Promise.all([
    getAllLeads({ status, cityId, source, from, to, notViewed, q, page }),
    getLeadCities(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface p-3">
        <input type="hidden" name="view" value="all" />
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="name or phone"
            className="h-9 rounded-control border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Status
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-control border border-border bg-background px-2 text-sm">
            <option value="">Any</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          City
          <select name="city" defaultValue={cityId ?? ""} className="h-9 rounded-control border border-border bg-background px-2 text-sm">
            <option value="">Any</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Source
          <select name="source" defaultValue={source ?? ""} className="h-9 rounded-control border border-border bg-background px-2 text-sm">
            <option value="">Any</option>
            {SOURCES.map((sc) => (
              <option key={sc} value={sc}>{sc}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          From
          <input type="date" name="from" defaultValue={from} className="h-9 rounded-control border border-border bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          To
          <input type="date" name="to" defaultValue={to} className="h-9 rounded-control border border-border bg-background px-2 text-sm" />
        </label>
        <label className="flex items-center gap-1.5 self-end pb-2 text-meta text-muted-foreground">
          <input type="checkbox" name="notViewed" value="1" defaultChecked={notViewed} /> Not viewed
        </label>
        <button type="submit" className="h-9 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>

      <p className="text-meta text-muted-foreground">{result.total} leads</p>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Buyer</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Listing</th>
              <th className="px-3 py-2 font-medium">Assigned to</th>
              <th className="px-3 py-2 font-medium">Viewed</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">↻</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.rows.map((l) => (
              <tr key={l.id} className="bg-surface">
                <td className="px-3 py-2 whitespace-nowrap text-meta text-muted-foreground">
                  {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-ink-950">{l.buyerName}</div>
                  <div className="text-meta text-muted-foreground">+{l.phone}</div>
                </td>
                <td className="px-3 py-2 text-meta text-muted-foreground">{l.source}</td>
                <td className="px-3 py-2 text-meta text-muted-foreground">{l.listing?.title ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.assignedDealer?.businessName ?? "—"}</td>
                <td className="px-3 py-2">
                  {l.viewed ? (
                    <Badge tone="success" size="sm">Viewed</Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">No</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[l.status] ?? "neutral"} size="sm">{l.status}</Badge>
                </td>
                <td className="px-3 py-2 text-meta text-muted-foreground">{l.reassignCount || ""}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <LeadReassignAction leadId={l.id} status={l.status} cityId={l.cityId} currentDealerName={l.assignedDealer?.businessName} />
                    <Link href={`/admin/leads/${l.id}`} className="font-medium text-clay-700 hover:underline">
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No leads match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- dealer-wise summary ----

async function DealerSummary() {
  const rows = await getDealerLeadSummary();
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface px-4 py-16 text-center text-muted-foreground">
        No leads have been assigned to any dealer yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Dealer</th>
            <th className="px-3 py-2 font-medium">Received</th>
            <th className="px-3 py-2 font-medium">Viewed</th>
            <th className="px-3 py-2 font-medium">SLA missed</th>
            <th className="px-3 py-2 font-medium">Avg view</th>
            <th className="px-3 py-2 font-medium">Platform</th>
            <th className="px-3 py-2 font-medium">WhatsApp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.dealerId} className="bg-surface">
              <td className="px-3 py-2 font-medium text-ink-950">{r.businessName}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.received}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.viewed}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.slaMissed}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.avgViewMinutes != null ? `${r.avgViewMinutes} min` : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.platformLeads}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.whatsappLeads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "rounded-control px-3 py-1.5 text-sm font-medium transition-colors " +
        (active ? "bg-ink-900 text-primary-foreground" : "bg-surface-muted text-muted-foreground hover:bg-sand-200")
      }
    >
      {label}
    </Link>
  );
}
