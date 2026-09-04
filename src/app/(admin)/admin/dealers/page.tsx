import type { Metadata } from "next";
import Link from "next/link";

import { getDealersForAdmin } from "@/lib/dealers/admin";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin — Dealers" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  banned: "danger",
};

export default async function AdminDealersPage({ searchParams }: PageProps<"/admin/dealers">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const dealers = await getDealersForAdmin({ q, status });

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Dealers</h1>
        <p className="mt-1 text-muted-foreground">
          Verify documents to set a dealer&apos;s tier. A Tier-0 dealer&apos;s listings never
          go live.
        </p>
      </div>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Search
          <input name="q" defaultValue={q} placeholder="business, name, phone" className="h-9 rounded-control border border-border bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Status
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-control border border-border bg-background px-2 text-sm">
            <option value="">Any</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="banned">banned</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Dealer</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Docs</th>
              <th className="px-3 py-2 font-medium">Rating</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dealers.map((d) => (
              <tr key={d.id} className="bg-surface">
                <td className="px-3 py-2">
                  <div className="font-medium text-ink-950">{d.businessName}</div>
                  <div className="text-meta text-muted-foreground">+{d.phone}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium text-ink-900">Tier {d.tier}</span>
                  <span className="ml-1 text-meta text-muted-foreground">{d.tierLabel}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[d.status] ?? "warning"} size="sm">{d.status}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.verifiedDocs}/{d.uploadedDocs} verified
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.ratingCount > 0 ? `★ ${d.rating} (${d.ratingCount})` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/dealers/${d.id}`} className="font-medium text-clay-700 hover:underline">
                    Verify
                  </Link>
                </td>
              </tr>
            ))}
            {dealers.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No dealers.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
