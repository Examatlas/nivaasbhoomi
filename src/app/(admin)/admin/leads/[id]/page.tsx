import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, ScrollText, User } from "lucide-react";

import { getLeadDetail, getEligibleDealers } from "@/lib/leads/admin-leads";
import { Badge } from "@/components/ui/badge";
import { AdminAssignPanel } from "@/components/admin/admin-assign-panel";

export const metadata: Metadata = { title: "Admin — Lead" };
export const dynamic = "force-dynamic";

const AUDIT_LABEL: Record<string, string> = {
  "lead.auto-assign": "Auto-assigned by routing",
  "lead.admin-assign": "Admin manual assignment",
  "lead.admin-override-reassign": "Admin OVERRIDE reassignment",
  "lead.status-change": "Status changed",
};

export default async function AdminLeadDetailPage({ params }: PageProps<"/admin/leads/[id]">) {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  const dealers = await getEligibleDealers(lead.cityId);
  const isAssigned = Boolean(lead.assignedDealer);

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1 text-meta text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to leads
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: details + conversation */}
        <div className="flex flex-col gap-6">
          <section className="rounded-card border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display-sm">{lead.buyerName}</h1>
              <Badge tone={isAssigned ? "clay" : "danger"} size="sm">{lead.status}</Badge>
            </div>
            <a href={`tel:+${lead.phone}`} className="mt-1 inline-block text-sm font-medium text-wa-700 hover:underline">
              +{lead.phone}
            </a>
            {lead.reason && (
              <p className="mt-2 rounded-control bg-warning-50 px-3 py-2 text-meta text-warning-700">
                {lead.reason}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row k="Source" v={lead.source} />
              <Row k="Purpose" v={lead.purpose} />
              <Row k="Property" v={[lead.bhk ? `${lead.bhk} BHK` : null].filter(Boolean).join(" ") || undefined} />
              <Row k="Budget" v={lead.budget} />
              <Row k="Timeline" v={lead.timeline} />
              <Row k="Loan" v={lead.loanRequired == null ? undefined : lead.loanRequired ? "Yes" : "No"} />
              <Row k="City" v={lead.cityName} />
              <Row k="Locality" v={lead.localityName} />
              <Row k="Qualification" v={lead.qualificationScore != null ? `${lead.qualificationScore}/100` : undefined} />
              {lead.listing && <Row k="Listing" v={lead.listing.title} />}
              {lead.otherListings && lead.otherListings.length > 0 && (
                <Row k="Also enquired (same dealer)" v={lead.otherListings.map((o) => o.title).join(", ")} />
              )}
              {lead.assignedDealer && <Row k="Assigned to" v={lead.assignedDealer.businessName} />}
            </dl>

            {lead.dealerNotes && (
              <div className="mt-4 rounded-control border border-border bg-surface-muted p-3 text-sm">
                <p className="text-meta text-muted-foreground">Dealer notes</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{lead.dealerNotes}</p>
              </div>
            )}
          </section>

          {/* Conversation viewer (read-only) */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-950">
              <MessageSquare className="size-4 text-clay-600" /> WhatsApp conversation
            </h2>
            {lead.conversation.length === 0 ? (
              <p className="text-meta text-muted-foreground">No conversation logged for this number.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lead.conversation.map((m, i) => (
                  <div
                    key={i}
                    className={
                      "max-w-[80%] rounded-card px-3 py-2 text-sm " +
                      (m.direction === "in"
                        ? "self-start bg-surface-muted text-foreground"
                        : "self-end bg-wa-50 text-ink-900")
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.timestamp && (
                      <p className="mt-1 text-overline text-subtle-foreground">
                        {new Date(m.timestamp).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: assignment + audit */}
        <div className="flex flex-col gap-6">
          <AdminAssignPanel
            leadId={lead.id}
            isAssigned={isAssigned}
            currentDealerName={lead.assignedDealer?.businessName}
            dealers={dealers}
          />

          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-950">
              <ScrollText className="size-4 text-clay-600" /> Audit trail
            </h2>
            {lead.audit.length === 0 ? (
              <p className="text-meta text-muted-foreground">No actions recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {lead.audit.map((a, i) => (
                  <li key={i} className="border-l-2 border-border pl-3 text-sm">
                    <p className="font-medium text-ink-950">{AUDIT_LABEL[a.action] ?? a.action}</p>
                    <p className="text-meta text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" /> {a.actorType}
                        {a.actorId ? ` (${a.actorId})` : ""}
                      </span>
                      {a.prevDealerName && a.dealerName ? ` · ${a.prevDealerName} → ${a.dealerName}` : ""}
                      {!a.prevDealerName && a.dealerName ? ` · → ${a.dealerName}` : ""}
                    </p>
                    {a.reason && <p className="text-meta text-muted-foreground">“{a.reason}”</p>}
                    <p className="text-overline text-subtle-foreground">
                      {new Date(a.at).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-ink-950">{v}</dd>
    </>
  );
}
