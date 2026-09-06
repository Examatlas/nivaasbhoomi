"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat, Search, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface EligibleDealer {
  id: string;
  businessName: string;
  tier: number;
  quota: string;
  hasQuota: boolean;
  coversCity: boolean;
}

/** Closed leads can't be reassigned; everything else can. Mirrors canReassign(). */
function reassignable(status: string): boolean {
  return status !== "converted" && status !== "lost";
}

/**
 * Manual reassign — available on EVERY non-closed lead (assigned, unassigned,
 * unclaimed, viewed, unviewed), in both the list and the detail view. Opens a
 * modal with a searchable list of eligible active dealers + an optional note.
 */
export function LeadReassignAction({
  leadId,
  status,
  cityId,
  currentDealerName,
  size = "sm",
  variant = "outline",
}: {
  leadId: string;
  status: string;
  cityId?: string;
  currentDealerName?: string;
  size?: "sm" | "md";
  variant?: "outline" | "primary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dealers, setDealers] = useState<EligibleDealer[] | null>(null);
  const [q, setQ] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reassignable(status)) return null;

  async function openModal() {
    setOpen(true);
    setError(null);
    if (dealers) return;
    try {
      const res = await apiFetch<{ dealers: EligibleDealer[] }>(
        `/api/admin/leads/eligible-dealers${cityId ? `?cityId=${cityId}` : ""}`,
      );
      setDealers(res.dealers);
    } catch {
      setError("Could not load dealers.");
    }
  }

  async function submit() {
    if (!dealerId) {
      setError("Pick a dealer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        body: JSON.stringify({ dealerId, ...(note.trim() ? { reason: note.trim() } : {}) }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not reassign.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = (dealers ?? []).filter((d) =>
    d.businessName.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={openModal}>
        <Repeat className="size-4" /> Reassign
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-ink-950">Reassign lead</h2>
            {currentDealerName && (
              <p className="mt-0.5 text-meta text-muted-foreground">
                Currently with <b>{currentDealerName}</b>. The previous dealer&apos;s quota is
                refunded and the new dealer is charged.
              </p>
            )}

            <div className="relative mt-4">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search dealers…"
                className="pl-9"
              />
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto rounded-control border border-border">
              {dealers === null ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-meta text-muted-foreground">No dealers match.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setDealerId(d.id)}
                        className={
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted " +
                          (dealerId === d.id ? "bg-clay-50" : "")
                        }
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-ink-950">{d.businessName}</span>
                          <span className="ml-2 text-meta text-muted-foreground">
                            tier {d.tier} · quota {d.quota}
                            {d.coversCity ? " · covers city" : ""}
                            {!d.hasQuota ? " · over quota" : ""}
                          </span>
                        </span>
                        {dealerId === d.id && <Check className="size-4 shrink-0 text-clay-600" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason / note (optional, saved to history)"
              maxLength={500}
              className="mt-3"
            />

            {error && <p className="mt-2 text-meta text-danger-700">{error}</p>}

            <div className="mt-4 flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={busy || !dealerId}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />}
                Confirm reassign
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
