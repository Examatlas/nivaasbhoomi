"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";

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

type Tab = "coverage" | "requests" | "cities" | "localities" | "states";

const TABS: { id: Tab; label: string }[] = [
  { id: "coverage", label: "Live coverage" },
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

      {tab === "coverage" && <CoveragePanel />}
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
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState("");
  const [active, setActive] = useState(""); // "" | "true" | "false"
  const [hasListings, setHasListings] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: { _id: string; name: string }[] }>(
      "/api/admin/locations/cities?active=true&limit=100",
    )
      .then((r) => setCities(r.items.map((c) => ({ _id: c._id, name: c.name }))))
      .catch(() => {});
  }, []);

  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/localities?${qs({
        q,
        page,
        limit,
        cityId,
        active,
        hasListings: hasListings ? "true" : "",
      })}`,
    [cityId, active, hasListings],
  );

  async function act(
    id: string,
    action: "approve" | "activate" | "deactivate",
    reload: () => void,
  ) {
    setBusy(id);
    try {
      if (action === "approve") {
        await apiFetch(`/api/admin/locations/localities/${id}/approve`, { method: "POST" });
        toast.success("Locality approved");
      } else {
        const res = await apiFetch<{ isActive: boolean; reasons: string[] }>(
          `/api/admin/locations/localities/${id}/activate`,
          { method: "POST", body: JSON.stringify({ active: action === "activate" }) },
        );
        if (action === "activate") {
          if (res.isActive) toast.success("Locality is live");
          else toast.message("Not eligible yet", { description: res.reasons[0] ?? "" });
        } else {
          toast.success("Locality deactivated");
        }
      }
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const selectCls =
    "rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-foreground";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={selectCls}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={selectCls}>
          <option value="">Any state</option>
          <option value="true">Active (live)</option>
          <option value="false">Inactive</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={hasListings}
            onChange={(e) => setHasListings(e.target.checked)}
          />
          With listings only
        </label>
      </div>
      <PaginatedPanel<LocalityRow>
        endpoint={endpoint}
        columns={["Locality", "City", "Status", "Listings", "Real", "Live", "Action"]}
        searchPlaceholder="Search localities by name…"
        emptyLabel="No localities found."
        renderRow={(l, reload) => (
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
            <td className="px-4 py-3 text-muted-foreground">{l.cityName}</td>
            <td className="px-4 py-3">
              <Badge tone={l.status === "approved" ? "ink" : "warning"} size="sm">
                {l.status}
              </Badge>
            </td>
            <td className="tabular px-4 py-3 font-medium text-ink-900">{l.listingCount}</td>
            <td className="tabular px-4 py-3 text-muted-foreground">{l.realListingCount}</td>
            <td className="px-4 py-3">
              <ActiveBadge active={l.isActive} />
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {l.status === "pending" && (
                  <Button size="sm" onClick={() => act(l._id, "approve", reload)} disabled={busy === l._id}>
                    Approve
                  </Button>
                )}
                {l.isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(l._id, "deactivate", reload)}
                    disabled={busy === l._id}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(l._id, "activate", reload)}
                    disabled={busy === l._id}
                    title="Activate if it meets the guard (3+ listings, intro text)"
                  >
                    Activate
                  </Button>
                )}
              </div>
            </td>
          </tr>
        )}
      />
    </div>
  );
}

// ---- States -----------------------------------------------------------------

function StatesPanel() {
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const endpoint = useCallback(
    ({ q, page, limit }: { q: string; page: number; limit: number }) =>
      `/api/admin/locations/states?${qs({ q, page, limit })}`,
    [],
  );

  async function setActive(id: string, active: boolean, reload: () => void) {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/locations/states/${id}/activate`, {
        method: "POST",
        body: JSON.stringify({ active }),
      });
      toast.success(active ? "State activated" : "State deactivated");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not update state.");
    } finally {
      setBusy(null);
    }
  }

  async function syncFromCities() {
    setBusy("__sync__");
    try {
      const r = await apiFetch<{ total: number; active: number }>(
        "/api/admin/locations/states/sync",
        { method: "POST" },
      );
      toast.success(`Synced ${r.total} states — ${r.active} now active.`);
      setReloadKey((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-muted-foreground">
          A state auto-activates when its first city goes live. Use Sync to backfill.
        </p>
        <Button size="sm" variant="outline" onClick={syncFromCities} disabled={busy === "__sync__"}>
          {busy === "__sync__" && <Loader2 className="size-4 animate-spin" />} Sync from cities
        </Button>
      </div>
      <PaginatedPanel<StateRow>
        endpoint={endpoint}
        reloadKey={reloadKey}
        columns={["State", "Code", "Active cities", "Status", "Action"]}
        searchPlaceholder="Search states…"
        emptyLabel="No states found."
        limit={50}
        renderRow={(s, reload) => (
          <tr key={s._id} className="hover:bg-surface-muted/40">
            <td className="px-4 py-3 font-medium text-ink-950">
              {s.name}
              <span className="ml-2 text-meta text-subtle-foreground">/{s.slug}</span>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{s.code}</td>
            <td className="tabular px-4 py-3 text-muted-foreground">
              {s.activeCityCount} / {s.cityCount}
            </td>
            <td className="px-4 py-3">
              <ActiveBadge active={s.isActive} />
            </td>
            <td className="px-4 py-3">
              {s.isActive ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActive(s._id, false, reload)}
                  disabled={busy === s._id}
                >
                  {busy === s._id && <Loader2 className="size-4 animate-spin" />} Deactivate
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setActive(s._id, true, reload)}
                  disabled={busy === s._id}
                >
                  {busy === s._id && <Loader2 className="size-4 animate-spin" />} Activate
                </Button>
              )}
            </td>
          </tr>
        )}
      />
    </div>
  );
}

// ---- Live coverage ----------------------------------------------------------

interface CovLocality {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  realListings: number;
  seedListings: number;
}
interface CovCity {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  realListings: number;
  seedListings: number;
  dealers: number;
  localities: CovLocality[];
}
interface CovState {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  cities: CovCity[];
}
interface CoverageData {
  summary: { states: number; cities: number; localities: number; localitiesWithInventory: number };
  states: CovState[];
}

function CoverageStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-2">
      <p className="tabular text-lg font-semibold text-ink-950">{value ?? "—"}</p>
      <p className="text-overline text-subtle-foreground uppercase">{label}</p>
    </div>
  );
}

function CoveragePanel() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<CoverageData>(
      `/api/admin/locations/coverage?${qs({ includeInactive: showInactive ? "true" : "" })}`,
    )
      .then(setData)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Failed to load coverage."))
      .finally(() => setLoading(false));
  }, [showInactive]);

  function copyText() {
    if (!data) return;
    const lines: string[] = [
      `Live coverage — ${data.summary.states} states, ${data.summary.cities} cities, ${data.summary.localities} localities`,
    ];
    for (const s of data.states) {
      if (!showInactive && !s.isActive) continue;
      lines.push(`${s.name}${s.isActive ? "" : " (inactive)"}`);
      for (const c of s.cities) {
        if (!showInactive && !c.isActive) continue;
        lines.push(
          `  ${c.name}${c.isActive ? "" : " (inactive)"} — ${c.realListings} real / ${c.seedListings} seed, ${c.dealers} dealers`,
        );
        for (const l of c.localities) {
          if (!showInactive && !l.isActive) continue;
          lines.push(
            `    ${l.name}${l.isActive ? "" : " (not live)"} — ${l.realListings} real / ${l.seedListings} seed`,
          );
        }
      }
    }
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Copy failed"));
  }

  const visibleStates = (data?.states ?? []).filter((s) => showInactive || s.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <CoverageStat label="states live" value={data?.summary.states} />
          <CoverageStat label="cities live" value={data?.summary.cities} />
          <CoverageStat label="localities live" value={data?.summary.localities} />
          <CoverageStat label="localities w/ inventory" value={data?.summary.localitiesWithInventory} />
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive too
          </label>
          <Button size="sm" variant="outline" onClick={copyText} disabled={!data}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading coverage…</p>}
      {error && <p className="text-sm text-danger-700">{error}</p>}

      {data && visibleStates.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">Nothing live yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {visibleStates.map((s) => {
          const cities = s.cities.filter((c) => showInactive || c.isActive);
          if (cities.length === 0) return null;
          return (
            <div key={s._id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-ink-950">{s.name}</h3>
                <ActiveBadge active={s.isActive} />
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {cities.map((c) => {
                  const locs = c.localities.filter((l) => showInactive || l.isActive);
                  return (
                    <div key={c._id} className="rounded-control border border-border/70 bg-surface-muted/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/locations/cities/${c._id}`} className="font-medium text-ink-900 hover:underline">
                          {c.name}
                        </Link>
                        <ActiveBadge active={c.isActive} />
                        <span className="text-meta text-muted-foreground">
                          {c.realListings} real / {c.seedListings} seed · {c.dealers} dealers
                        </span>
                      </div>
                      {locs.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {locs.map((l) => (
                            <li
                              key={l._id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-meta"
                              title={l.isActive ? "Locality page is live" : "Has inventory, page not live yet"}
                            >
                              <span className={l.isActive ? "text-ink-800" : "text-subtle-foreground"}>
                                {l.name}
                              </span>
                              <span className="tabular text-subtle-foreground">
                                {l.realListings}/{l.seedListings}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
