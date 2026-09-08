"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Admin: bulk-delete all seed (display-only) listings in a chosen city. */
export function SeedBulkDelete({ cities }: { cities: { cityId: string; cityName: string; count: number }[] }) {
  const router = useRouter();
  const [cityId, setCityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (cities.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        No seed (display-only) listings live right now.
      </div>
    );
  }

  async function del() {
    if (!cityId) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ deleted: number }>("/api/admin/listings/seed-delete", {
        method: "POST",
        body: JSON.stringify({ cityId }),
      });
      setMsg(`Deleted ${r.deleted} seed listing(s).`);
      setCityId("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
      <span className="text-sm font-medium text-ink-900">Seed listings:</span>
      <div className="w-64">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger><SelectValue placeholder="Choose a city…" /></SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.cityId} value={c.cityId}>
                {c.cityName} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="danger" size="sm" onClick={del} disabled={busy || !cityId}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Delete all seed in city
      </Button>
      {msg && <span className="text-meta text-muted-foreground">{msg}</span>}
    </div>
  );
}
