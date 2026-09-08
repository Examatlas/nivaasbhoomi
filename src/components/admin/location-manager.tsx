"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const [reloadKey, setReloadKey] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/cities?${qs({ q, page, limit })}`,
    [],
  );

  async function activateRow(id: string, reload: () => void) {
    setRowBusy(id);
    try {
      await apiFetch(`/api/admin/locations/cities/${id}/activate`, {
        method: "POST",
        body: JSON.stringify({ active: true }),
      });
      toast.success("City activated");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not activate city.");
    } finally {
      setRowBusy(null);
    }
  }

  async function activateAll() {
    setBulkBusy(true);
    try {
      const res = await apiFetch<{
        activatedCount: number;
        skipped: { slug: string }[];
      }>("/api/admin/locations/cities/activate-all", { method: "POST" });
      toast.success(
        `Activated ${res.activatedCount} eligible cit${res.activatedCount === 1 ? "y" : "ies"}` +
          (res.skipped.length ? ` — ${res.skipped.length} not eligible yet.` : "."),
      );
      setReloadKey((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Bulk activate failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-muted-foreground">
          Listings = approved (seed included, the activation basis). Real = excludes seed.
        </p>
        <Button size="sm" onClick={activateAll} disabled={bulkBusy}>
          {bulkBusy && <Loader2 className="size-4 animate-spin" />} Activate all eligible cities
        </Button>
      </div>
      <PaginatedPanel<CityRow>
        endpoint={endpoint}
        reloadKey={reloadKey}
        columns={["City", "Tier", "Listings", "Real", "Dealers", "Localities", "Status", "Action"]}
        searchPlaceholder="Search cities…"
        emptyLabel="No cities found."
        renderRow={(c, reload) => (
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
            <td className="tabular px-4 py-3 font-medium text-ink-900">{c.listingCount}</td>
            <td className="tabular px-4 py-3 text-muted-foreground">{c.realListingCount}</td>
            <td className="tabular px-4 py-3 text-muted-foreground">{c.dealerCount}</td>
            <td className="tabular px-4 py-3 text-muted-foreground">{c.localityCount}</td>
            <td className="px-4 py-3">
              <ActiveBadge active={c.isActive} />
            </td>
            <td className="px-4 py-3">
              {c.isActive ? (
                <span className="text-meta text-subtle-foreground">—</span>
              ) : (
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant={c.canActivate ? "primary" : "outline"}
                    onClick={() => activateRow(c._id, reload)}
                    disabled={!c.canActivate || rowBusy === c._id}
                    title={c.canActivate ? "Activate this city" : (c.activationHint ?? "")}
                  >
                    {rowBusy === c._id && <Loader2 className="size-4 animate-spin" />} Activate
                  </Button>
                  {!c.canActivate && c.activationHint && (
                    <span className="text-overline text-subtle-foreground">
                      {c.activationHint}
                    </span>
                  )}
                </div>
              )}
            </td>
          </tr>
        )}
      />
    </div>
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
