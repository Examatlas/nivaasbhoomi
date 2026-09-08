import type { Metadata } from "next";
import Link from "next/link";

import { connectDB } from "@/lib/db/connect";
import { ListingReport } from "@/lib/db/models/ListingReport";
import { Listing } from "@/lib/db/models/Listing";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  "fake-listing": "Fake / fraudulent",
  "already-sold": "Already sold / rented",
  "wrong-price": "Wrong price",
  "wrong-photos": "Wrong / misleading photos",
  other: "Other",
};

/**
 * Admin queue of buyer-submitted listing reports (open first). Guarded by the
 * Edge proxy (every /admin/* route requires an admin session). Read-only triage
 * view: the reason, note, when, and a link to the reported listing.
 */
export default async function AdminReportsPage() {
  await connectDB();

  const reports = await ListingReport.find({}, undefined, {
    sort: { status: 1, createdAt: -1 },
    limit: 200,
  }).lean();

  const listingIds = [...new Set(reports.map((r) => String(r.listingId)))];
  const listings = await Listing.find(
    { _id: { $in: listingIds } },
    { title: 1, slug: 1, status: 1 },
  ).lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));

  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-display-sm">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buyer-submitted listing reports. {openCount} open.
        </p>
      </header>

      {reports.length === 0 ? (
        <p className="rounded-card border border-border bg-surface px-4 py-12 text-center text-sm text-muted-foreground">
          No reports yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Listing</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => {
                const listing = byId.get(String(r.listingId));
                return (
                  <tr key={String(r._id)} className="align-top">
                    <td className="px-4 py-3">
                      {listing?.slug ? (
                        <Link
                          href={`/property/${listing.slug}`}
                          className="font-medium text-ink-900 hover:underline"
                        >
                          {listing.title ?? listing.slug}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {String(r.listingId)} (missing)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{REASON_LABEL[r.reason ?? "other"] ?? r.reason}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.note || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === "open"
                            ? "rounded-full bg-warning-50 px-2 py-0.5 text-meta font-medium text-warning-700"
                            : "rounded-full bg-surface-muted px-2 py-0.5 text-meta text-muted-foreground"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
