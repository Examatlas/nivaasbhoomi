"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";

import { apiFetch, ApiClientError } from "@/lib/api/client";

interface StaffListing {
  _id: string;
  title: string;
  slug: string | null;
  status: string;
  dealerId: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-success-50 text-success-700",
  pending: "bg-warning-50 text-warning-800",
  "pending-location": "bg-warning-50 text-warning-800",
  rejected: "bg-danger-50 text-danger-700",
  draft: "bg-surface-muted text-muted-foreground",
};

export function StaffListings() {
  const [rows, setRows] = useState<StaffListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<StaffListing[]>("/api/staff/listings");
        if (alive) setRows(data);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load listings.");
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
        No listings yet. Open a dealer and publish their first listing.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border text-left text-meta text-muted-foreground">
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Dealer</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l._id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-ink-950">{l.title}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    "inline-flex rounded-full px-2 py-0.5 text-meta font-medium " +
                    (STATUS_STYLES[l.status] ?? "bg-surface-muted text-muted-foreground")
                  }
                >
                  {l.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/staff/dealers/${l.dealerId}`} className="text-ink-700 hover:underline">
                  Dealer
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                {l.status === "approved" && l.slug ? (
                  <a
                    href={`/property/${l.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-ink-700 hover:underline"
                  >
                    View live <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
