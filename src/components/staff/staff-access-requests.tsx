"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

interface AccessReq {
  _id: string;
  dealerId: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
}

const STATUS_STYLES: Record<AccessReq["status"], string> = {
  pending: "bg-warning-50 text-warning-800",
  approved: "bg-success-50 text-success-700",
  rejected: "bg-danger-50 text-danger-700",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function StaffAccessRequests() {
  const [rows, setRows] = useState<AccessReq[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<AccessReq[]>("/api/staff/access-requests");
        if (alive) setRows(data);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load requests.");
        setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) return <p className="text-sm text-danger-700">{error}</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
        You haven&apos;t requested access to any dealers. Open a dealer you don&apos;t have
        access to and use “Request access”.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border text-left text-meta text-muted-foreground">
            <th className="px-4 py-3 font-medium">Dealer</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Requested</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Admin note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 tabular text-muted-foreground">{r.dealerId}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmt(r.requestedAt)}</td>
              <td className="px-4 py-3">
                <span className={"inline-flex rounded-full px-2 py-0.5 text-meta font-medium " + STATUS_STYLES[r.status]}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.adminNote ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
