"use client";

import { useEffect, useState } from "react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";

interface Opt {
  _id: string;
  name: string;
}

export interface LocationValue {
  stateId: string;
  cityId: string;
  localityId: string;
}

/**
 * Cascading state -> city -> locality selector driven by the public location
 * APIs. Selecting a state loads its cities; selecting a city loads its
 * (approved) localities. Reused by the admin listing form.
 */
export function CascadingLocation({
  value,
  onChange,
  disabled,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  disabled?: boolean;
}) {
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [localities, setLocalities] = useState<Opt[]>([]);

  // Load states once.
  useEffect(() => {
    apiFetch<Opt[]>("/api/locations/states")
      .then(setStates)
      .catch(() => setStates([]));
  }, []);

  // Load cities when the state changes (data-fetching effect).
  useEffect(() => {
    if (!value.stateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities([]);
      return;
    }
    apiFetch<Opt[]>(`/api/locations/cities?stateId=${value.stateId}`)
      .then(setCities)
      .catch(() => setCities([]));
  }, [value.stateId]);

  // Load localities when the city changes (data-fetching effect).
  useEffect(() => {
    if (!value.cityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalities([]);
      return;
    }
    apiFetch<Opt[]>(`/api/locations/localities?cityId=${value.cityId}`)
      .then(setLocalities)
      .catch(() => setLocalities([]));
  }, [value.cityId]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label required>State</Label>
        <Select
          value={value.stateId || undefined}
          onValueChange={(stateId) => onChange({ stateId, cityId: "", localityId: "" })}
          disabled={disabled}
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
        <Label required>City</Label>
        <Select
          value={value.cityId || undefined}
          onValueChange={(cityId) => onChange({ ...value, cityId, localityId: "" })}
          disabled={disabled || !value.stateId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={value.stateId ? "Select city" : "Pick a state first"}
            />
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

      <div className="flex flex-col gap-1.5">
        <Label required>Locality</Label>
        <Select
          value={value.localityId || undefined}
          onValueChange={(localityId) => onChange({ ...value, localityId })}
          disabled={disabled || !value.cityId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={value.cityId ? "Select locality" : "Pick a city first"}
            />
          </SelectTrigger>
          <SelectContent>
            {localities.map((l) => (
              <SelectItem key={l._id} value={l._id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
