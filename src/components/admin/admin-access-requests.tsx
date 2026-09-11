"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface AccessReq {
  _id: string;
  staffId: string;
  staffName: string;
  dealerId: string;
  dealerName: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string | null;
}

type Tab = "pending" | "all";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_TONE: Record<AccessReq["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export function AdminAccessRequests() {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<AccessReq[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setError(null);
    setRows(null);
    try {
      const url = t === "all" ? "/api/admin/access-requests?status=all" : "/api/admin/access-requests";
      setRows(await apiFetch<AccessReq[]>(url));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load requests.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  async function review(id: string, action: "approve" | "reject") {
    let note: string | undefined;
    if (action === "reject") {
      note = window.prompt("Optional note for the staff (why rejected)?") ?? undefined;
    }
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/access-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: note?.trim() || undefined }),
      });
      await load(tab);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {(["pending", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "rounded-control border px-3 py-1.5 text-sm font-medium capitalize " +
              (tab === t
                ? "border-clay-200 bg-clay-50 text-clay-800"
                : "border-border bg-surface text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {tab === "pending" ? "No pending access requests." : "No access requests."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Dealer</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Requested</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r._id} className="bg-surface">
                  <td className="px-3 py-2 font-medium text-ink-950">{r.staffName}</td>
                  <td className="px-3 py-2">
                    <div className="text-ink-900">{r.dealerName}</div>
                    <div className="tabular text-meta text-muted-foreground">{r.dealerId}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(r.requestedAt)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[r.status]} size="sm">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={() => review(r._id, "approve")} disabled={busyId === r._id}>
                          {busyId === r._id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => review(r._id, "reject")}
                          disabled={busyId === r._id}
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-right text-meta text-muted-foreground">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
