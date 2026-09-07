"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Runs the rate-aggregation job on demand and refreshes the dashboard. */
export function RatesComputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function compute() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ listingsScanned: number; localityUpserts: number; cityUpserts: number }>(
        "/api/admin/rates/compute",
        { method: "POST" },
      );
      setMsg(`Computed from ${r.listingsScanned} listings → ${r.localityUpserts} locality + ${r.cityUpserts} city aggregates.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Compute failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={compute} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Compute now
      </Button>
      {msg && <p className="text-meta text-muted-foreground">{msg}</p>}
    </div>
  );
}
