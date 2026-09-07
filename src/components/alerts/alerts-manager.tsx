"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, BellOff, Trash2, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

export interface AlertRow {
  id: string;
  summary: string;
  active: boolean;
  unsubscribed: boolean;
  viewHref: string;
}

/** Buyer's alert management. Full controls when logged in (canManage); a
 *  token-only visitor gets the read-only list + the one-click unsubscribe. */
export function AlertsManager({
  rows,
  canManage,
  unsubscribeToken,
}: {
  rows: AlertRow[];
  canManage: boolean;
  unsubscribeToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, active: boolean) {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not update the alert.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/api/alerts/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not delete the alert.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="mt-8 rounded-card border border-border bg-surface px-4 py-12 text-center text-muted-foreground">
        You have no property alerts yet. Open any city or locality and tap{" "}
        <b>Set a WhatsApp alert</b> to get notified about new listings.
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error && <p className="text-meta text-danger-700">{error}</p>}

      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
          <div className="min-w-0">
            <p className="font-medium text-ink-950">{r.summary}</p>
            <p className="mt-0.5 text-meta text-muted-foreground">
              {r.unsubscribed ? "Unsubscribed" : r.active ? "Active — alerts on" : "Paused"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={r.viewHref} className="inline-flex items-center gap-1 text-sm font-medium text-clay-700 hover:underline">
              View listings <ArrowRight className="size-3.5" />
            </Link>
            {canManage && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => toggle(r.id, !(r.active && !r.unsubscribed))} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : r.active && !r.unsubscribed ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
                  {r.active && !r.unsubscribed ? "Pause" : "Resume"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={busy === r.id} aria-label="Delete alert">
                  <Trash2 className="size-3.5 text-danger-700" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-border pt-4">
        <a
          href={`/api/alerts/unsubscribe/${encodeURIComponent(unsubscribeToken)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-danger-700 hover:underline"
        >
          <BellOff className="size-4" /> Turn off all alerts
        </a>
        {!canManage && (
          <p className="mt-2 text-meta text-muted-foreground">
            <Link href="/login?next=/alerts" className="text-clay-700 hover:underline">Sign in</Link> to pause or delete individual alerts.
          </p>
        )}
      </div>
    </div>
  );
}
