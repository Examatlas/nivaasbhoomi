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
interface CityOpt extends Opt {
  lat?: number | null;
  lng?: number | null;
}
interface LocalityOpt extends Opt {
  pincode?: string | null;
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
 *
 * Locality options show their pincode ("Baram (834001)") because India Post
 * data has the same locality name across several pincodes - the pincode makes
 * each option distinguishable. onCityCenter reports the selected city's
 * coordinates so a map picker can centre on it.
 */
export function CascadingLocation({
  value,
  onChange,
  onCityCenter,
  disabled,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  onCityCenter?: (center: { lat: number; lng: number } | null) => void;
  disabled?: boolean;
}) {
  const [states, setStates] = useState<Opt[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [localities, setLocalities] = useState<LocalityOpt[]>([]);

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
    apiFetch<CityOpt[]>(`/api/locations/cities?stateId=${value.stateId}`)
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
    apiFetch<LocalityOpt[]>(`/api/locations/localities?cityId=${value.cityId}`)
      .then(setLocalities)
      .catch(() => setLocalities([]));
  }, [value.cityId]);

  // Report the selected city's centre (for the map picker) whenever it resolves.
  useEffect(() => {
    if (!onCityCenter) return;
    const city = cities.find((c) => c._id === value.cityId);
    if (city && city.lat != null && city.lng != null) {
      onCityCenter({ lat: city.lat, lng: city.lng });
    } else {
      onCityCenter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cityId, cities]);

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
                {l.pincode ? (
                  <span className="ml-1 text-muted-foreground">({l.pincode})</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
