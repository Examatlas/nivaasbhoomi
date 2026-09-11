"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { ChevronDown, Check, Search, Loader2, MapPinPlus, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

/**
 * Shared searchable location picker (state → city → locality). ONE component for
 * every form in the app — no per-form re-implementation.
 *
 * - State (36) and City (754/state-scoped) load fully and filter client-side.
 * - Locality (~162k) is SERVER-searched (debounced 250ms, min 2 chars), scoped
 *   to the selected city, matched by name OR pincode, ranked, capped at 20.
 * - Free text is NOT allowed — only an existing option can be selected.
 * - Cascade reset: changing state clears city+locality; changing city clears
 *   locality.
 * - Keyboard (↑/↓/Enter/Esc), ARIA combobox/listbox, thumb-friendly targets.
 * - When a locality isn't found, the user can request it (name + pincode).
 */

export interface LocationOption {
  id: string;
  name: string;
  hint?: string | null; // e.g. pincode, shown muted
}
export interface LocationValue {
  stateId: string;
  cityId: string;
  localityId: string;
}
export type LocationLevel = "state" | "city" | "locality";

// ── SearchSelect: one searchable combobox (client-filter or server-search) ────
export function SearchSelect({
  label,
  required,
  disabled,
  placeholder,
  selectedLabel,
  mode,
  clientOptions,
  onServerSearch,
  minChars = 2,
  onSelect,
  emptyFooter,
  invalid,
  id,
}: {
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder: string;
  selectedLabel: string | null;
  mode: "client" | "server";
  clientOptions?: LocationOption[];
  onServerSearch?: (q: string) => Promise<LocationOption[]>;
  minChars?: number;
  onSelect: (opt: LocationOption) => void;
  /** Rendered under the results (e.g. "request locality") — receives the current query. */
  emptyFooter?: (query: string, close: () => void) => React.ReactNode;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<LocationOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = React.useRef(0);

  const close = React.useCallback(() => setOpen(false), []);

  // Client mode: filter the given options by the query.
  React.useEffect(() => {
    if (mode !== "client") return;
    const q = query.trim().toLowerCase();
    const opts = clientOptions ?? [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults(q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(0);
  }, [mode, query, clientOptions]);

  // Server mode: debounced search (min chars), race-safe.
  React.useEffect(() => {
    if (mode !== "server" || !open) return;
    const q = query.trim();
    if (timer.current) clearTimeout(timer.current);
    if (q.length < minChars) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const myId = ++reqId.current;
    timer.current = setTimeout(async () => {
      try {
        const r = (await onServerSearch?.(q)) ?? [];
        if (myId === reqId.current) {
          setResults(r);
          setActive(0);
        }
      } catch {
        if (myId === reqId.current) setResults([]);
      } finally {
        if (myId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, query, open, minChars, onServerSearch]);

  // Reset transient state on open/close.
  React.useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
    }
  }, [open]);

  const pick = (opt: LocationOption) => {
    onSelect(opt);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = results[active];
      if (opt) pick(opt);
    }
  }

  const showMinChars = mode === "server" && query.trim().length > 0 && query.trim().length < minChars;
  const showEmpty = !loading && !showMinChars && results.length === 0 && (mode === "client" || query.trim().length >= minChars);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label required={required}>{label}</Label>}
      <PopoverPrimitive.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverPrimitive.Trigger
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 py-2 text-left text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ink-500/30 disabled:cursor-not-allowed disabled:opacity-50",
            invalid ? "border-danger-300" : "border-border",
          )}
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[--radix-popover-trigger-width] min-w-[16rem] rounded-card border border-border bg-surface p-1.5 shadow-lift"
          >
            <div className="flex items-center gap-2 rounded-control border border-border px-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={mode === "server" ? "Type name or pincode…" : "Search…"}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
            </div>

            <ul id={listId} role="listbox" className="mt-1.5 max-h-64 overflow-y-auto">
              {showMinChars && (
                <li className="px-2.5 py-2 text-meta text-muted-foreground">
                  Type at least {minChars} characters…
                </li>
              )}
              {results.map((o, i) => (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm",
                    i === active ? "bg-ink-50 text-ink-950" : "text-ink-900",
                  )}
                >
                  <span className="truncate">
                    {o.name}
                    {o.hint ? <span className="ml-1 text-muted-foreground">({o.hint})</span> : null}
                  </span>
                  {i === active && <Check className="size-4 shrink-0 text-clay-600" aria-hidden />}
                </li>
              ))}
              {showEmpty && (
                <li className="px-2.5 py-2 text-meta text-muted-foreground">No matches.</li>
              )}
            </ul>

            {showEmpty && emptyFooter && (
              <div className="mt-1.5 border-t border-border pt-1.5">{emptyFooter(query.trim(), close)}</div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

// ── LocationPicker: the cascading state/city/locality composition ─────────────
export function LocationPicker({
  value,
  onChange,
  levels = ["state", "city", "locality"],
  required = true,
  disabled,
  onCityCenter,
  allowLocalityRequest = true,
  invalid,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  levels?: LocationLevel[];
  required?: boolean;
  disabled?: boolean;
  onCityCenter?: (center: { lat: number; lng: number } | null) => void;
  allowLocalityRequest?: boolean;
  invalid?: Partial<Record<LocationLevel, boolean>>;
}) {
  const [states, setStates] = React.useState<LocationOption[]>([]);
  const [cities, setCities] = React.useState<(LocationOption & { lat?: number | null; lng?: number | null })[]>([]);
  const [localityLabel, setLocalityLabel] = React.useState<string | null>(null);

  const hasLocality = levels.includes("locality");

  // Load states once.
  React.useEffect(() => {
    apiFetch<{ _id: string; name: string }[]>("/api/locations/states")
      .then((r) => setStates(r.map((s) => ({ id: s._id, name: s.name }))))
      .catch(() => setStates([]));
  }, []);

  // Load cities when the state changes.
  React.useEffect(() => {
    if (!value.stateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities([]);
      return;
    }
    apiFetch<{ _id: string; name: string; lat?: number; lng?: number }[]>(
      `/api/locations/cities?stateId=${value.stateId}`,
    )
      .then((r) => setCities(r.map((c) => ({ id: c._id, name: c.name, lat: c.lat, lng: c.lng }))))
      .catch(() => setCities([]));
  }, [value.stateId]);

  // Report the selected city's centre (for a map picker) when it resolves.
  React.useEffect(() => {
    if (!onCityCenter) return;
    const city = cities.find((c) => c.id === value.cityId);
    onCityCenter(city && city.lat != null && city.lng != null ? { lat: city.lat, lng: city.lng } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cityId, cities]);

  // Resolve the preset locality's label by id (edit mode) — the picker never
  // loads the full city list, so it fetches just this one.
  React.useEffect(() => {
    if (!hasLocality) return;
    if (!value.localityId || !value.cityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalityLabel(null);
      return;
    }
    apiFetch<{ _id: string; name: string; pincode: string | null }[]>(
      `/api/locations/localities?cityId=${value.cityId}&id=${value.localityId}`,
    )
      .then((r) => {
        const l = r[0];
        setLocalityLabel(l ? (l.pincode ? `${l.name} (${l.pincode})` : l.name) : null);
      })
      .catch(() => setLocalityLabel(null));
  }, [hasLocality, value.cityId, value.localityId]);

  const stateName = states.find((s) => s.id === value.stateId)?.name ?? null;
  const cityName = cities.find((c) => c.id === value.cityId)?.name ?? null;

  const searchLocalities = React.useCallback(
    async (q: string): Promise<LocationOption[]> => {
      if (!value.cityId) return [];
      const rows = await apiFetch<{ _id: string; name: string; pincode: string | null }[]>(
        `/api/locations/localities?cityId=${value.cityId}&q=${encodeURIComponent(q)}`,
      );
      return rows.map((l) => ({ id: l._id, name: l.name, hint: l.pincode }));
    },
    [value.cityId],
  );

  return (
    <div className={cn("grid gap-4", levels.length >= 3 ? "sm:grid-cols-3" : levels.length === 2 && "sm:grid-cols-2")}>
      {levels.includes("state") && (
        <SearchSelect
          label="State"
          required={required}
          disabled={disabled}
          placeholder="Select state"
          selectedLabel={stateName}
          mode="client"
          clientOptions={states}
          invalid={invalid?.state}
          onSelect={(s) => onChange({ stateId: s.id, cityId: "", localityId: "" })}
        />
      )}

      {levels.includes("city") && (
        <SearchSelect
          label="City / District"
          required={required}
          disabled={disabled || !value.stateId}
          placeholder={value.stateId ? "Select city" : "Pick a state first"}
          selectedLabel={cityName}
          mode="client"
          clientOptions={cities}
          invalid={invalid?.city}
          onSelect={(c) => onChange({ ...value, cityId: c.id, localityId: "" })}
        />
      )}

      {hasLocality && (
        <SearchSelect
          label="Locality"
          required={required}
          disabled={disabled || !value.cityId}
          placeholder={value.cityId ? "Search locality" : "Pick a city first"}
          selectedLabel={localityLabel}
          mode="server"
          onServerSearch={searchLocalities}
          invalid={invalid?.locality}
          onSelect={(l) => {
            setLocalityLabel(l.hint ? `${l.name} (${l.hint})` : l.name);
            onChange({ ...value, localityId: l.id });
          }}
          emptyFooter={
            allowLocalityRequest
              ? (query, closePanel) => (
                  <LocalityRequestInline
                    cityId={value.cityId}
                    initialName={query}
                    onCreated={(id, name, pincode) => {
                      setLocalityLabel(pincode ? `${name} (${pincode})` : name);
                      onChange({ ...value, localityId: id });
                      closePanel();
                    }}
                  />
                )
              : undefined
          }
        />
      )}
    </div>
  );
}

// ── Inline "request a locality" form (empty-state) ────────────────────────────
function LocalityRequestInline({
  cityId,
  initialName,
  onCreated,
}: {
  cityId: string;
  initialName: string;
  onCreated: (localityId: string, name: string, pincode: string) => void;
}) {
  const [openForm, setOpenForm] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [pincode, setPincode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initialName);
  }, [initialName]);

  if (!openForm) {
    return (
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpenForm(true);
        }}
        className="flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-meta font-medium text-clay-700 hover:bg-clay-50"
      >
        <MapPinPlus className="size-4" aria-hidden /> Can&apos;t find your locality? Request to add
      </button>
    );
  }

  async function submit() {
    if (name.trim().length < 2) {
      setError("Enter the locality name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ localityId: string; existing: boolean }>(
        "/api/locations/locality-request",
        {
          method: "POST",
          body: JSON.stringify({ cityId, name: name.trim(), pincode: pincode.trim() || undefined }),
        },
      );
      onCreated(res.localityId, name.trim(), pincode.trim());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-1.5" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-meta font-semibold text-ink-900">Request a new locality</span>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); setOpenForm(false); }} aria-label="Cancel">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Locality name" />
      <Input
        value={pincode}
        onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Pincode (optional)"
        inputMode="numeric"
      />
      {error && <p className="text-meta text-danger-700">{error}</p>}
      <Button size="sm" onMouseDown={(e) => { e.preventDefault(); void submit(); }} disabled={busy} block>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Submit request
      </Button>
    </div>
  );
}
