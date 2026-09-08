"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, ChevronDown, Search, LocateFixed, Loader2, Check } from "lucide-react";

import { useCity } from "@/components/public/city/city-provider";
import { nearestActiveCity } from "@/lib/locations/geo";

/**
 * Header city chip: location icon + current city + dropdown arrow. The dropdown
 * lists the live cities, a filter box, and a "Use my location" button. GPS is
 * requested ONLY on that button — never on page load.
 */
export function CitySwitcher() {
  const { cities, resolution, ready, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(term));
  }, [q, cities]);

  if (cities.length === 0) return null; // nothing live yet — no chip

  // Label: resolved city once ready, else the default (first) — no flash/shift.
  const current = resolution?.city ?? cities[0]!;

  function choose(slug: string) {
    setCity(slug);
    setOpen(false);
    setQ("");
  }

  function useMyLocation() {
    setLocateError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const near = nearestActiveCity(cities, pos.coords.latitude, pos.coords.longitude);
        if (near) choose(near.slug);
        else setLocateError("No live city near you yet.");
      },
      () => {
        setLocating(false);
        setLocateError("Couldn't get your location. Pick a city instead.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-900 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ink-600/30"
      >
        <MapPin className="size-4 text-clay-600" aria-hidden="true" />
        <span className="max-w-[7rem] truncate">{ready ? current.name : current.name}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-card border border-border bg-surface shadow-overlay"
        >
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-control bg-surface-muted px-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a city"
                autoFocus
                className="w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-subtle-foreground"
                aria-label="Search a city"
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {matches.map((c) => {
              const active = c.slug === current.slug;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => choose(c.slug)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-ink-800 hover:bg-surface-muted"
                    role="menuitem"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4 text-clay-500" aria-hidden="true" />
                      {c.name}
                    </span>
                    {active && <Check className="size-4 text-clay-600" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {matches.length === 0 && (
              <li className="px-4 py-3 text-meta text-muted-foreground">
                No live city matches that.
              </li>
            )}
          </ul>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-ink-800 hover:bg-surface-muted disabled:opacity-60"
              role="menuitem"
            >
              {locating ? (
                <Loader2 className="size-4 animate-spin text-clay-600" aria-hidden="true" />
              ) : (
                <LocateFixed className="size-4 text-clay-600" aria-hidden="true" />
              )}
              {locating ? "Finding you…" : "Use my location"}
            </button>
            {locateError && (
              <p className="px-3 pt-1 text-meta text-muted-foreground">{locateError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
