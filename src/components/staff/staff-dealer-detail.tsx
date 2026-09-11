"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  BadgeCheck,
  PlusCircle,
  Lock,
  Send,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";

const DOC_KEYS = ["pan", "aadhaar", "gst", "udyam", "rera", "officePhoto"] as const;
type DocKey = (typeof DOC_KEYS)[number];
const DOC_LABELS: Record<DocKey, string> = {
  pan: "PAN",
  aadhaar: "Aadhaar",
  gst: "GST",
  udyam: "Udyam",
  rera: "RERA",
  officePhoto: "Office photo",
};

interface DealerDetail {
  _id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string | null;
  status: string;
  verificationTier: number;
  documents: Partial<Record<DocKey, { verified?: boolean }>>;
  listingCount: number;
  mine: boolean;
}

export function StaffDealerDetail({ id }: { id: string }) {
  const [dealer, setDealer] = useState<DealerDetail | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<DealerDetail>(`/api/staff/dealers/${id}`);
        if (alive) setDealer(d);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
          setDenied(true); // out of scope (or does not exist) — offer to request access
        } else {
          setError(err instanceof ApiClientError ? err.message : "Failed to load dealer.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (denied) return <RequestAccess dealerId={id} />;

  if (error) {
    return (
      <div>
        <BackLink />
        <p className="mt-4 text-sm text-danger-700">{error}</p>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-display-sm">{dealer.businessName}</h1>
            <p className="mt-1 text-muted-foreground">
              {dealer.name} · <span className="tabular">{dealer.phone}</span>
              {dealer.email ? ` · ${dealer.email}` : ""}
            </p>
          </div>
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium " +
              (dealer.verificationTier > 0
                ? "bg-success-50 text-success-700"
                : "bg-surface-muted text-muted-foreground")
            }
          >
            {dealer.verificationTier > 0 && <BadgeCheck className="size-4" />}
            {dealer.verificationTier > 0 ? `Tier ${dealer.verificationTier}` : "Unverified"}
          </span>
        </div>
      </div>

      <VerifyCard dealer={dealer} onSaved={(tier) => setDealer({ ...dealer, verificationTier: tier })} />

      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink-950">Listings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {dealer.verificationTier > 0
            ? "Create a listing and publish it live directly — no admin approval needed."
            : "Verify the dealer to Tier 1+ before you can publish a listing live."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild disabled={dealer.verificationTier < 1}>
            <Link href={`/staff/dealers/${dealer._id}/listings/new`}>
              <PlusCircle className="size-4" /> Create &amp; publish listing
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/listings">View all listings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerifyCard({
  dealer,
  onSaved,
}: {
  dealer: DealerDetail;
  onSaved: (tier: number) => void;
}) {
  const [flags, setFlags] = useState<Record<DocKey, boolean>>(() => {
    const init = {} as Record<DocKey, boolean>;
    for (const k of DOC_KEYS) init[k] = Boolean(dealer.documents[k]?.verified);
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch<{ _id: string; verificationTier: number }>(
        `/api/staff/dealers/${dealer._id}/verify`,
        { method: "POST", body: JSON.stringify(flags) },
      );
      onSaved(res.verificationTier);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save verification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink-950">
        <ShieldCheck className="size-5 text-clay-600" /> Verification
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Mark the documents you&apos;ve verified. The dealer&apos;s tier is recomputed
        automatically from what&apos;s verified.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DOC_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={flags[k]}
              onCheckedChange={(c) => setFlags((f) => ({ ...f, [k]: Boolean(c) }))}
            />
            {DOC_LABELS[k]}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger-700">{error}</p>}
      {saved && !error && (
        <p className="mt-3 text-sm text-success-700">Verification saved.</p>
      )}
      <div className="mt-4">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
          Save verification
        </Button>
      </div>
    </div>
  );
}

function RequestAccess({ dealerId }: { dealerId: string }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/staff/access-requests", {
        method: "POST",
        body: JSON.stringify({ dealerId, reason: reason.trim() || undefined }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to send request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <BackLink />
      <div className="mt-4 rounded-card border border-border bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-clay-700">
          <Lock className="size-5" />
          <h1 className="text-lg font-semibold text-ink-950">No access to this dealer</h1>
        </div>
        {done ? (
          <p className="text-sm text-success-700">
            Request sent. An admin will review it — you&apos;ll get access once approved.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This dealer isn&apos;t in your list. Request access and an admin will review
              it. Add a short reason to help them decide.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ra-reason">Reason (optional)</Label>
              <Textarea
                id="ra-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need access to this dealer?"
              />
            </div>
            {error && <p className="text-sm text-danger-700">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Request access
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/staff"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> My dealers
    </Link>
  );
}
