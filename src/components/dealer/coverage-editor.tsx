"use client";

import { useEffect, useState } from "react";
import { Plus, X, MapPin, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchSelect, type LocationOption } from "@/components/shared/location-picker";
import { apiFetch } from "@/lib/api/client";

export interface CoverageEntry {
  cityId: string;
  cityName: string;
  // pincode is kept so a selected chip can disambiguate same-named localities
  // (e.g. two "Adalahatu" with different pincodes).
  localities: { localityId: string; name: string; pincode?: string | null }[];
}

export interface CoverageValue {
  coverageCities: string[];
  coverageLocalities: string[];
}

/**
 * Coverage editor (DEV-SPEC.txt Section 4): pick state -> city, then SEARCH and
 * add the localities served in that city, and Add. All three levels use the
 * shared searchable picker (SearchSelect) so a metro's hundreds of localities
 * are searchable, not a giant scroll. Coverage shows as removable chips grouped
 * by city. Controlled: the parent owns { coverageCities, coverageLocalities }.
 */
export function CoverageEditor({
  entries,
  onChange,
}: {
  entries: CoverageEntry[];
  onChange: (entries: CoverageEntry[], value: CoverageValue) => void;
}) {
  const [states, setStates] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  // Localities queued to add to the current city (id -> {name, pincode}).
  const [pending, setPending] = useState<Record<string, { name: string; pincode?: string | null }>>({});

  useEffect(() => {
    apiFetch<{ _id: string; name: string }[]>("/api/locations/states")
      .then((r) => setStates(r.map((s) => ({ id: s._id, name: s.name }))))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!stateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities([]);
      return;
    }
    apiFetch<{ _id: string; name: string }[]>(`/api/locations/cities?stateId=${stateId}`)
      .then((r) => setCities(r.map((c) => ({ id: c._id, name: c.name }))))
      .catch(() => setCities([]));
  }, [stateId]);

  function emit(next: CoverageEntry[]) {
    const coverageCities = next.map((e) => e.cityId);
    const coverageLocalities = next.flatMap((e) => e.localities.map((l) => l.localityId));
    onChange(next, { coverageCities, coverageLocalities });
  }

  function addCoverage() {
    if (!cityId) return;
    const localitiesToAdd = Object.entries(pending).map(([localityId, v]) => ({
      localityId,
      name: v.name,
      pincode: v.pincode,
    }));
    const existing = entries.find((e) => e.cityId === cityId);
    let next: CoverageEntry[];
    if (existing) {
      const seen = new Set(existing.localities.map((l) => l.localityId));
      const merged = [
        ...existing.localities,
        ...localitiesToAdd.filter((l) => !seen.has(l.localityId)),
      ];
      next = entries.map((e) => (e.cityId === cityId ? { ...e, localities: merged } : e));
    } else {
      next = [...entries, { cityId, cityName, localities: localitiesToAdd }];
    }
    emit(next);
    setPending({});
  }

  function removeCity(id: string) {
    emit(entries.filter((e) => e.cityId !== id));
  }
  function removeLocality(cId: string, lId: string) {
    emit(
      entries.map((e) =>
        e.cityId === cId
          ? { ...e, localities: e.localities.filter((l) => l.localityId !== lId) }
          : e,
      ),
    );
  }

  async function searchLocalities(q: string): Promise<LocationOption[]> {
    if (!cityId) return [];
    const rows = await apiFetch<{ _id: string; name: string; pincode: string | null }[]>(
      `/api/locations/localities?cityId=${cityId}&q=${encodeURIComponent(q)}`,
    );
    return rows.map((l) => ({ id: l._id, name: l.name, hint: l.pincode }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SearchSelect
            label="State"
            placeholder="Select state"
            mode="client"
            clientOptions={states}
            selectedLabel={states.find((s) => s.id === stateId)?.name ?? null}
            onSelect={(s) => {
              setStateId(s.id);
              setCityId("");
              setCityName("");
              setPending({});
            }}
          />
          <SearchSelect
            label="City / District"
            placeholder={stateId ? "Select city" : "Pick a state first"}
            disabled={!stateId}
            mode="client"
            clientOptions={cities}
            selectedLabel={cities.find((c) => c.id === cityId)?.name ?? null}
            onSelect={(c) => {
              setCityId(c.id);
              setCityName(c.name);
              setPending({});
            }}
          />
        </div>

        {cityId && (
          <div className="mt-3 flex flex-col gap-2">
            <SearchSelect
              label={`Localities served in ${cityName} (optional)`}
              placeholder="Search localities to add"
              mode="server"
              onServerSearch={searchLocalities}
              selectedLabel={null}
              onSelect={(o) =>
                setPending((prev) => ({ ...prev, [o.id]: { name: o.name, pincode: o.hint ?? null } }))
              }
            />
            {Object.keys(pending).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pending).map(([id, v]) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-clay-200 bg-clay-50 px-2.5 py-1 text-meta text-clay-800"
                  >
                    <MapPin className="size-3" />
                    {v.name}
                    {v.pincode ? <span className="text-clay-600">({v.pincode})</span> : null}
                    <button
                      type="button"
                      onClick={() =>
                        setPending((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          return next;
                        })
                      }
                      aria-label={`Remove ${v.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-meta text-muted-foreground">
              Leave localities empty to cover the whole city.
            </p>
            <Button size="sm" className="mt-1 self-start" onClick={addCoverage}>
              <Plus className="size-4" /> Add {cityName} to coverage
            </Button>
          </div>
        )}
      </div>

      {/* Current coverage chips */}
      {entries.length === 0 ? (
        <p className="text-meta text-muted-foreground">
          No coverage yet. Add at least one city so leads can be routed to you.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => (
            <div key={e.cityId} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-clay-600" />
                <span className="font-medium text-ink-950">{e.cityName}</span>
                <button
                  type="button"
                  onClick={() => removeCity(e.cityId)}
                  className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-danger-700"
                  aria-label={`Remove ${e.cityName}`}
                >
                  <X className="size-4" />
                </button>
              </div>
              {e.localities.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.localities.map((l) => (
                    <span
                      key={l.localityId}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-meta text-ink-800"
                    >
                      <MapPin className="size-3 text-clay-500" />
                      {l.name}
                      {l.pincode ? <span className="text-muted-foreground">({l.pincode})</span> : null}
                      <button
                        type="button"
                        onClick={() => removeLocality(e.cityId, l.localityId)}
                        className="text-muted-foreground hover:text-danger-700"
                        aria-label={`Remove ${l.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-meta text-muted-foreground">
                  Whole city (no specific localities).
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
