"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Admin: mark/unmark a listing as a seed (display-only) listing + set expiry. */
export function SeedToggle({
  listingId,
  initialIsSeed,
  initialExpiresAt,
}: {
  listingId: string;
  initialIsSeed: boolean;
  initialExpiresAt: string | null;
}) {
  const router = useRouter();
  const [isSeed, setIsSeed] = useState(initialIsSeed);
  const [expiry, setExpiry] = useState(initialExpiresAt ? initialExpiresAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/listings/${listingId}/seed`, {
        method: "POST",
        body: JSON.stringify({
          isSeed: next,
          ...(next && expiry ? { seedExpiresAt: new Date(expiry).toISOString() } : {}),
        }),
      });
      setIsSeed(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
        <Sprout className="size-4 text-clay-600" /> Seed listing
      </span>
      {isSeed ? <Badge tone="warning" size="sm">Seed — display only</Badge> : <Badge tone="neutral" size="sm">Real listing</Badge>}
      {isSeed && (
        <label className="flex items-center gap-1.5 text-meta text-muted-foreground">
          Expires
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-8 w-40 text-sm" />
        </label>
      )}
      <Button type="button" size="sm" variant={isSeed ? "outline" : "primary"} onClick={() => save(!isSeed)} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {isSeed ? "Unmark seed" : "Mark as seed"}
      </Button>
      {isSeed && (
        <Button type="button" size="sm" variant="ghost" onClick={() => save(true)} disabled={busy}>
          Save expiry
        </Button>
      )}
      {error && <span className="text-meta text-danger-700">{error}</span>}
    </div>
  );
}
