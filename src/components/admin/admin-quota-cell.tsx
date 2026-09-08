"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Pencil } from "lucide-react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Admin quota cell (STEP 3.6): shows "used / max" and lets an admin edit the
 * monthly quota inline (audit-logged server-side). Exhausted dealers are tinted.
 */
export function AdminQuotaCell({
  dealerId,
  used,
  max,
}: {
  dealerId: string;
  used: number;
  max: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(max));
  const [curMax, setCurMax] = useState(max);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = used >= curMax;

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setError("Enter a whole number ≥ 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/dealers/${dealerId}/quota`, {
        method: "PATCH",
        body: JSON.stringify({ maxLeadsPerMonth: n }),
      });
      setCurMax(n);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update quota.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-7 w-16 rounded-control border border-border bg-background px-1.5 text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            aria-label="Save quota"
            className="inline-flex size-7 items-center justify-center rounded-control bg-primary text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
        </div>
        {error && <span className="text-meta text-danger-700">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(String(curMax));
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1.5"
      title="Edit quota"
    >
      <span className={"tabular font-medium " + (exhausted ? "text-warning-700" : "text-ink-900")}>
        {used} / {curMax}
      </span>
      <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
