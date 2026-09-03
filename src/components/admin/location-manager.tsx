"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginatedPanel } from "@/components/admin/paginated-panel";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type {
  StateRow,
  CityRow,
  LocalityRow,
  LocalityRequestRow,
} from "@/types/admin-locations";

type Tab = "requests" | "cities" | "localities" | "states";

const TABS: { id: Tab; label: string }[] = [
  { id: "requests", label: "Requests" },
  { id: "cities", label: "Cities" },
  { id: "localities", label: "Localities" },
  { id: "states", label: "States" },
];

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" size="sm">
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      Inactive
    </Badge>
  );
}

const qs = (params: Record<string, string | number>) =>
  Object.entries(params)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export function LocationManager() {
  const [tab, setTab] = useState<Tab>("requests");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "text-ink-950"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink-900" />
            )}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsPanel />}
      {tab === "cities" && <CitiesPanel />}
      {tab === "localities" && <LocalitiesPanel />}
      {tab === "states" && <StatesPanel />}
    </div>
  );
}

// ---- Requests ---------------------------------------------------------------

function RequestsPanel() {
  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/locality-requests?${qs({ q, page, limit })}`,
    [],
  );

  const act = async (id: string, action: "approve" | "reject", reload: () => void) => {
    try {
      await apiFetch(`/api/admin/locations/localities/${id}/${action}`, {
        method: "POST",
      });
      toast.success(action === "approve" ? "Locality approved" : "Request rejected");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Action failed");
    }
  };

  return (
    <PaginatedPanel<LocalityRequestRow>
      endpoint={endpoint}
      columns={["Locality", "City", "Pincodes", "Requested", "Actions"]}
      searchPlaceholder="Search pending requests…"
      emptyLabel="No pending locality requests."
      renderRow={(r, reload) => (
        <tr key={r._id} className="hover:bg-surface-muted/40">
          <td className="px-4 py-3 font-medium text-ink-950">
            <Link
              href={`/admin/locations/localities/${r._id}`}
              className="hover:underline"
            >
              {r.name}
            </Link>
          </td>
          <td className="px-4 py-3 text-muted-foreground">{r.city?.name ?? "—"}</td>
          <td className="px-4 py-3 text-muted-foreground">
            {r.pincodes.length ? r.pincodes.join(", ") : "—"}
          </td>
          <td className="px-4 py-3 text-muted-foreground">
            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(r._id, "approve", reload)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(r._id, "reject", reload)}
              >
                Reject
              </Button>
            </div>
          </td>
        </tr>
      )}
    />
  );
}

// ---- Cities -----------------------------------------------------------------

function CitiesPanel() {
  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/cities?${qs({ q, page, limit })}`,
    [],
  );

  return (
    <PaginatedPanel<CityRow>
      endpoint={endpoint}
      columns={["City", "Tier", "Listings", "Dealers", "Localities", "Status"]}
      searchPlaceholder="Search cities…"
      emptyLabel="No cities found."
      renderRow={(c) => (
        <tr key={c._id} className="hover:bg-surface-muted/40">
          <td className="px-4 py-3 font-medium text-ink-950">
            <Link href={`/admin/locations/cities/${c._id}`} className="hover:underline">
              {c.name}
            </Link>
            <span className="ml-2 text-meta text-subtle-foreground">/{c.slug}</span>
          </td>
          <td className="px-4 py-3">
            <Badge
              tone={c.tier === 1 ? "ink" : c.tier === 2 ? "clay" : "neutral"}
              size="sm"
            >
              Tier {c.tier}
            </Badge>
          </td>
          <td className="tabular px-4 py-3 text-muted-foreground">{c.listingCount}</td>
          <td className="tabular px-4 py-3 text-muted-foreground">{c.dealerCount}</td>
          <td className="tabular px-4 py-3 text-muted-foreground">{c.localityCount}</td>
          <td className="px-4 py-3">
            <ActiveBadge active={c.isActive} />
          </td>
        </tr>
      )}
    />
  );
}

// ---- Localities -------------------------------------------------------------

function LocalitiesPanel() {
  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/localities?${qs({ q, page, limit })}`,
    [],
  );

  return (
    <PaginatedPanel<LocalityRow>
      endpoint={endpoint}
      columns={["Locality", "Status", "Listings", "Pincodes", "Live"]}
      searchPlaceholder="Search localities by name…"
      emptyLabel="No localities found."
      renderRow={(l) => (
        <tr key={l._id} className="hover:bg-surface-muted/40">
          <td className="px-4 py-3 font-medium text-ink-950">
            <Link
              href={`/admin/locations/localities/${l._id}`}
              className="hover:underline"
            >
              {l.name}
            </Link>
            <span className="ml-2 text-meta text-subtle-foreground">/{l.slug}</span>
          </td>
          <td className="px-4 py-3">
            <Badge tone={l.status === "approved" ? "ink" : "warning"} size="sm">
              {l.status}
            </Badge>
          </td>
          <td className="tabular px-4 py-3 text-muted-foreground">{l.listingCount}</td>
          <td className="px-4 py-3 text-muted-foreground">
            {l.pincodes.slice(0, 3).join(", ")}
            {l.pincodes.length > 3 ? "…" : ""}
          </td>
          <td className="px-4 py-3">
            <ActiveBadge active={l.isActive} />
          </td>
        </tr>
      )}
    />
  );
}

// ---- States -----------------------------------------------------------------

function StatesPanel() {
  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/states?${qs({ q, page, limit })}`,
    [],
  );

  return (
    <PaginatedPanel<StateRow>
      endpoint={endpoint}
      columns={["State", "Code", "Slug", "Status"]}
      searchPlaceholder="Search states…"
      emptyLabel="No states found."
      limit={50}
      renderRow={(s) => (
        <tr key={s._id} className="hover:bg-surface-muted/40">
          <td className="px-4 py-3 font-medium text-ink-950">{s.name}</td>
          <td className="px-4 py-3 text-muted-foreground">{s.code}</td>
          <td className="px-4 py-3 text-muted-foreground">/{s.slug}</td>
          <td className="px-4 py-3">
            <ActiveBadge active={s.isActive} />
          </td>
        </tr>
      )}
    />
  );
}
