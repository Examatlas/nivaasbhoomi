import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  List,
  PlusCircle,
  BadgeCheck,
  MapPin,
  Inbox,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

import { getMyDealer, tierLadder, tierName } from "@/lib/dealers/account";
import { getMyLeadBreakdown } from "@/lib/leads/dealer-leads";
import { DealerShell } from "@/components/dealer/dealer-shell";
import { VerificationBadge } from "@/components/public/verification-badge";

export const metadata: Metadata = {
  title: "Dealer Dashboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DealerDashboardPage() {
  const dealer = await getMyDealer();
  if (!dealer) redirect("/dealer/login");
  if (!dealer.profileComplete) redirect("/dealer/onboarding");

  const [ladder, leadCounts] = [tierLadder(dealer), await getMyLeadBreakdown(dealer.id)];
  const nextRung = ladder.find((r) => r.isNext);

  return (
    <DealerShell active="/dealer/dashboard">
      <div className="mb-8">
        <h1 className="text-display-sm">Welcome back, {dealer.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">{dealer.businessName}</p>
      </div>

      {dealer.status === "pending" && (
        <div className="mb-6 rounded-card border border-warning-100 bg-warning-50 px-4 py-4 text-sm text-warning-700">
          <p className="font-semibold">Your account is awaiting admin approval.</p>
          <p className="mt-1">
            You can complete your profile now, but adding listings and receiving buyer leads will
            begin once our team approves your account.
          </p>
        </div>
      )}

      {dealer.status === "paused" && (
        <div className="mb-6 rounded-card border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Your account is paused, so new leads are on hold. Contact support to resolve this.
        </div>
      )}

      {/* Tier-0 (unverified) notice: the dealer is ACTIVE and can list, but
          listings stay private until documents are verified. No approval banner. */}
      {dealer.status === "active" && dealer.verificationTier === 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-card border border-clay-100 bg-clay-50 px-4 py-4 text-sm text-clay-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-clay-600" />
            <p>
              <span className="font-semibold">Your listings go live after we check your documents.</span>{" "}
              Upload them on the Verification page.
            </p>
          </div>
          <Link
            href="/dealer/verification"
            className="shrink-0 self-start rounded-control bg-clay-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-clay-700 sm:self-auto"
          >
            Upload documents
          </Link>
        </div>
      )}

      {/* Monthly lead quota (STEP 3.5). No paywall / upgrade copy — there is no
          paid plan yet; an exhausted month simply routes new enquiries via admin. */}
      {dealer.quota.used >= dealer.quota.max ? (
        <div className="mb-6 rounded-card border border-warning-100 bg-warning-50 px-4 py-4 text-sm text-warning-700">
          <p className="font-semibold">
            Your lead quota for this month ({dealer.quota.max}) is used up.
          </p>
          <p className="mt-1">
            Your quota refreshes on the 1st of next month. Until then, new enquiries for your
            listings are routed to you through our team.
          </p>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink-950">
              {dealer.quota.used} of {dealer.quota.max} leads this month
            </p>
            <p className="text-meta text-muted-foreground">Resets on the 1st.</p>
          </div>
          <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-surface-muted sm:block">
            <div
              className="h-full rounded-full bg-clay-500"
              style={{
                width: `${Math.min(100, Math.round((dealer.quota.used / Math.max(1, dealer.quota.max)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={List}
          label="Live listings"
          value={dealer.listingCounts.approved}
          sub={`${dealer.listingCounts.total} total · ${dealer.listingCounts.pending} in review`}
          href="/dealer/listings"
        />
        <StatCard
          icon={Inbox}
          label="Leads"
          value={leadCounts.total}
          sub={
            leadCounts.total > 0
              ? `${leadCounts.active} active · ${leadCounts.converted} converted`
              : "No leads yet"
          }
          href="/dealer/leads"
        />
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-meta text-muted-foreground">
            <ShieldCheck className="size-4" /> Verification
          </div>
          <div className="mt-2 flex items-center gap-2">
            {dealer.verificationTier >= 1 ? (
              <VerificationBadge tier={dealer.verificationTier} size="sm" />
            ) : (
              <span className="text-price text-ink-950">Tier 0</span>
            )}
          </div>
          <p className="mt-1 text-meta text-muted-foreground">
            {tierName(dealer.verificationTier)}
          </p>
        </div>
      </div>

      {/* Tier 0 warning */}
      {dealer.verificationTier === 0 && (
        <div className="mt-6 rounded-card border border-clay-100 bg-clay-50 px-4 py-3 text-sm text-clay-800">
          You can create listings now, but they won&apos;t go live until you&apos;re verified.
          Upload your PAN and Aadhaar on the{" "}
          <Link href="/dealer/verification" className="font-medium underline">
            verification page
          </Link>{" "}
          to get started.
        </div>
      )}

      {/* Next tier */}
      {nextRung && (
        <div className="mt-6 rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink-950">
            Next: {nextRung.label} (Tier {nextRung.tier})
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {nextRung.requirements.map((req) => (
              <li key={req.label} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    "inline-flex size-4 items-center justify-center rounded-full text-white " +
                    (req.met ? "bg-success-600" : "bg-sand-300")
                  }
                >
                  {req.met ? <BadgeCheck className="size-3" /> : null}
                </span>
                <span className={req.met ? "text-muted-foreground line-through" : ""}>
                  {req.label}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/dealer/verification"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-clay-700 hover:underline"
          >
            Go to verification <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="mt-10 mb-3 text-sm font-semibold text-ink-950">Quick actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard icon={PlusCircle} label="Add a listing" href="/dealer/listings/new" />
        <ActionCard icon={List} label="My listings" href="/dealer/listings" />
        <ActionCard icon={BadgeCheck} label="Verification" href="/dealer/verification" />
        <ActionCard icon={MapPin} label="Coverage & profile" href="/dealer/profile" />
      </div>
    </DealerShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-center gap-2 text-meta text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="mt-2 text-price text-ink-950 tabular">{value}</p>
      {sub && <p className="mt-1 text-meta text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ActionCard({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-ink-50 text-ink-700">
        <Icon className="size-5" />
      </span>
      <span className="font-medium text-ink-950">{label}</span>
    </Link>
  );
}
