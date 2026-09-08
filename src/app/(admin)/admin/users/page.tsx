import type { Metadata } from "next";
import Link from "next/link";

import { listBuyers, listDealerUsers } from "@/lib/admin/users";
import { Badge } from "@/components/ui/badge";
import { AdminConvertDealer } from "@/components/admin/admin-convert-dealer";

export const metadata: Metadata = { title: "Admin — Users" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  paused: "warning",
  banned: "danger",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const tab = sp.tab === "dealers" ? "dealers" : "buyers";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);
  const withoutDealer = sp.without === "1";

  const buyers = tab === "buyers" ? await listBuyers({ q, page, withoutDealer }) : null;
  const dealers = tab === "dealers" ? await listDealerUsers({ q, page }) : null;
  const result = buyers ?? dealers!;

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Users</h1>
        <p className="mt-1 text-muted-foreground">
          Everyone who has signed up — buyers and dealers.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1">
        <TabLink label="Buyers" href="/admin/users?tab=buyers" active={tab === "buyers"} />
        <TabLink label="Dealers" href="/admin/users?tab=dealers" active={tab === "dealers"} />
        {tab === "buyers" && (
          <>
            <span className="mx-2 h-5 w-px bg-border" aria-hidden />
            <TabLink label="All" href="/admin/users?tab=buyers" active={!withoutDealer} />
            <TabLink
              label="Without dealer"
              href="/admin/users?tab=buyers&without=1"
              active={withoutDealer}
            />
          </>
        )}
      </div>

      {/* Search */}
      <form
        method="get"
        className="mb-5 flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface p-3"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="flex flex-1 flex-col gap-1 text-meta text-muted-foreground">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder={tab === "buyers" ? "name, email, phone" : "business, name, email, phone"}
            className="h-9 rounded-control border border-border bg-background px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
        {q && (
          <Link
            href={`/admin/users?tab=${tab}`}
            className="h-9 rounded-control border border-border px-3 text-sm leading-9 text-muted-foreground hover:bg-surface-muted"
          >
            Clear
          </Link>
        )}
      </form>

      <p className="mb-2 text-meta text-muted-foreground">
        {result.total} {tab === "buyers" ? "buyer" : "dealer"}
        {result.total === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}
      </p>

      <div className="overflow-x-auto rounded-card border border-border">
        {tab === "buyers" ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-3 py-2 font-medium">Enquiries</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {buyers!.rows.map((u) => (
                <tr key={u.id} className="bg-surface">
                  <td className="px-3 py-2 font-medium text-ink-950">{u.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">+{u.phone}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                  <td className="px-3 py-2 tabular text-ink-900">{u.enquiryCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-3">
                      {u.hasDealer ? (
                        <span className="text-meta text-muted-foreground">Dealer</span>
                      ) : (
                        <AdminConvertDealer userId={u.id} userName={u.name} userPhone={u.phone} />
                      )}
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium text-clay-700 hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {buyers!.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    No buyers{q ? " match your search" : " yet"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Dealer</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Listings</th>
                <th className="px-3 py-2 font-medium">Leads</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dealers!.rows.map((d) => (
                <tr key={d.id} className="bg-surface">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink-950">{d.businessName}</div>
                    <div className="text-meta text-muted-foreground">
                      {d.name} · +{d.phone}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.email}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink-900">Tier {d.tier}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[d.status] ?? "warning"} size="sm">
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular text-ink-900">{d.listingCount}</td>
                  <td className="px-3 py-2 tabular text-ink-900">{d.leadCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(d.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/dealers/${d.id}`}
                      className="font-medium text-clay-700 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {dealers!.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    No dealers{q ? " match your search" : " yet"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {result.pageCount > 1 && (
        <Pagination tab={tab} q={q} page={result.page} pageCount={result.pageCount} />
      )}
    </div>
  );
}

function TabLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        "rounded-control px-4 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-ink-900 text-primary-foreground"
          : "bg-surface-muted text-muted-foreground hover:bg-sand-200")
      }
    >
      {label}
    </Link>
  );
}

function Pagination({
  tab,
  q,
  page,
  pageCount,
}: {
  tab: string;
  q?: string;
  page: number;
  pageCount: number;
}) {
  const href = (p: number) =>
    `/admin/users?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${p}`;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-control border border-border px-3 py-1.5 hover:bg-surface-muted">
          Previous
        </Link>
      ) : (
        <span className="rounded-control border border-border px-3 py-1.5 text-muted-foreground opacity-50">
          Previous
        </span>
      )}
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="rounded-control border border-border px-3 py-1.5 hover:bg-surface-muted">
          Next
        </Link>
      ) : (
        <span className="rounded-control border border-border px-3 py-1.5 text-muted-foreground opacity-50">
          Next
        </span>
      )}
    </div>
  );
}
