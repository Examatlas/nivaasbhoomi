"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Trash2, Pencil, Loader2 } from "lucide-react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Row actions for a dealer's own listing (edit / refresh / delete). Every call
 * hits an owner-scoped route, so a dealer can only act on their own listings.
 */
export function ListingActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "refresh" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const canRefresh = status === "approved" || status === "expired";

  async function refresh() {
    setBusy("refresh");
    setError(null);
    try {
      await apiFetch(`/api/listings/${id}/refresh`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not refresh.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    setBusy("delete");
    setError(null);
    try {
      await apiFetch(`/api/listings/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`/dealer/listings/${id}/edit`}
        className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-meta font-medium text-ink-800 hover:bg-surface-muted"
      >
        <Pencil className="size-3.5" /> Edit
      </Link>
      {canRefresh && (
        <button
          type="button"
          onClick={refresh}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-meta font-medium text-ink-800 hover:bg-surface-muted"
        >
          {busy === "refresh" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1.5 text-meta font-medium text-danger-700 hover:bg-danger-50"
      >
        {busy === "delete" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        Delete
      </button>
      {error && <span className="text-meta text-danger-700">{error}</span>}
    </div>
  );
}
