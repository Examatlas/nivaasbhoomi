"use client";

import { useEffect, useState } from "react";
import { Plus, X, MapPin, Building2 } from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api/client";

interface Opt {
  _id: string;
  name: string;
}
interface LocalityOpt extends Opt {
  pincode?: string | null;
}

export interface CoverageEntry {
  cityId: string;
  cityName: string;
  localities: { localityId: string; name: string }[];
}

export interface CoverageValue {
  coverageCities: string[];
  coverageLocalities: string[];
}

/**
 * Coverage editor (DEV-SPEC.txt Section 4): pick state -> city, multi-select the
 * localities served in that city, and Add. Coverage is the base for lead routing
 * later, so it's shown as clear, removable chips grouped by city and is fully
 * editable afterwards. A city can be covered broadly (no specific localities) or
 * narrowed to chosen localities.
 *
 * Controlled: the parent owns the derived { coverageCities, coverageLocalities }.
 */
export function CoverageEditor({
  entries,
  onChange,
}: {
  entries: CoverageEntry[];
  onChange: (entries: CoverageEntry[], value: CoverageValue) => void;
}) {
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [localities, setLocalities] = useState<LocalityOpt[]>([]);
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  const [checked, setChecked] = useState<Record<string, string>>({}); // id -> name

  useEffect(() => {
    apiFetch<Opt[]>("/api/locations/states")
      .then(setStates)
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!stateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities([]);
      return;
    }
    apiFetch<Opt[]>(`/api/locations/cities?stateId=${stateId}`)
      .then(setCities)
      .catch(() => setCities([]));
  }, [stateId]);

  useEffect(() => {
    if (!cityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalities([]);
      return;
    }
    apiFetch<LocalityOpt[]>(`/api/locations/localities?cityId=${cityId}`)
      .then(setLocalities)
      .catch(() => setLocalities([]));
  }, [cityId]);

  function emit(next: CoverageEntry[]) {
    const coverageCities = next.map((e) => e.cityId);
    const coverageLocalities = next.flatMap((e) =>
      e.localities.map((l) => l.localityId),
    );
    onChange(next, { coverageCities, coverageLocalities });
  }

  function addCoverage() {
    if (!cityId) return;
    const localitiesToAdd = Object.entries(checked).map(([localityId, name]) => ({
      localityId,
      name,
    }));
    const existing = entries.find((e) => e.cityId === cityId);
    let next: CoverageEntry[];
    if (existing) {
      // Merge localities into the existing city entry (dedup).
      const seen = new Set(existing.localities.map((l) => l.localityId));
      const merged = [
        ...existing.localities,
        ...localitiesToAdd.filter((l) => !seen.has(l.localityId)),
      ];
      next = entries.map((e) =>
        e.cityId === cityId ? { ...e, localities: merged } : e,
      );
    } else {
      next = [...entries, { cityId, cityName, localities: localitiesToAdd }];
    }
    emit(next);
    setChecked({});
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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>State</Label>
            <Select
              value={stateId || undefined}
              onValueChange={(v) => {
                setStateId(v);
                setCityId("");
                setCityName("");
                setChecked({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>City</Label>
            <Select
              value={cityId || undefined}
              onValueChange={(v) => {
                setCityId(v);
                setCityName(cities.find((c) => c._id === v)?.name ?? "");
                setChecked({});
              }}
              disabled={!stateId}
            >
              <SelectTrigger>
                <SelectValue placeholder={stateId ? "Select city" : "Pick a state first"} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {cityId && (
          <div className="mt-3">
            <Label>Localities served in {cityName} (optional)</Label>
            {localities.length === 0 ? (
              <p className="mt-1 text-meta text-muted-foreground">
                No approved localities here yet - you can still cover the whole city.
              </p>
            ) : (
              <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {localities.map((l) => (
                  <label
                    key={l._id}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-surface-muted"
                  >
                    <Checkbox
                      checked={Boolean(checked[l._id])}
                      onCheckedChange={(c) =>
                        setChecked((prev) => {
                          const next = { ...prev };
                          if (c) next[l._id] = l.name;
                          else delete next[l._id];
                          return next;
                        })
                      }
                    />
                    <span>
                      {l.name}
                      {l.pincode ? (
                        <span className="ml-1 text-muted-foreground">({l.pincode})</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button size="sm" className="mt-3" onClick={addCoverage}>
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
