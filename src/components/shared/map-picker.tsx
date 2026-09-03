"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Link2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { loadGoogleMaps } from "@/lib/maps/loader";
import { extractCoords } from "@/lib/maps/extract-coords";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPickerProps {
  value: LatLng | null;
  onChange: (lat: number, lng: number) => void;
  /** City centre to focus the map on before a pin is dropped. */
  center?: LatLng | null;
  disabled?: boolean;
}

const INDIA_DEFAULT: LatLng = { lat: 22.9734, lng: 78.6569 };
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Reusable Google Map location picker (DEV-SPEC.txt Sections 1, 4).
 *
 * - Places Autocomplete search box; typing a place jumps the pin there.
 * - A draggable pin; drag or click the map to set lat/lng.
 * - Paste a Google Maps link to extract coordinates (works even offline).
 * - Lazy: the Maps SDK loads only when the map scrolls into view (quota-safe).
 *
 * Fully controlled - the parent owns { lat, lng } via value/onChange. Used by
 * the admin listing form and, later, the dealer form.
 */
export function MapPicker({ value, onChange, center, disabled }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const searchElRef = useRef<HTMLInputElement>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  // Keep the latest onChange without re-instantiating the map.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const place = (lat: number, lng: number, pan = true) => {
    const pos = { lat, lng };
    if (markerRef.current) markerRef.current.setPosition(pos);
    if (pan && mapRef.current) {
      mapRef.current.panTo(pos);
      if ((mapRef.current.getZoom() ?? 0) < 14) mapRef.current.setZoom(16);
    }
    onChangeRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  };

  // Lazy-load: only instantiate the map when it scrolls into view.
  useEffect(() => {
    if (!API_KEY || status !== "idle") return;
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setStatus("loading");
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [status]);

  // Initialise the map once loading has been triggered.
  useEffect(() => {
    if (status !== "loading") return;
    let cancelled = false;

    loadGoogleMaps(API_KEY)
      .then((google) => {
        if (cancelled || !mapElRef.current) return;
        const start = value ?? center ?? INDIA_DEFAULT;
        const map = new google.maps.Map(mapElRef.current, {
          center: start,
          zoom: value ? 16 : center ? 13 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new google.maps.Marker({
          map,
          position: start,
          draggable: !disabled,
        });
        mapRef.current = map;
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) place(p.lat(), p.lng(), false);
        });
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (disabled || !e.latLng) return;
          place(e.latLng.lat(), e.latLng.lng(), false);
        });

        if (searchElRef.current) {
          const ac = new google.maps.places.Autocomplete(searchElRef.current, {
            fields: ["geometry"],
            componentRestrictions: { country: "in" },
          });
          ac.bindTo("bounds", map);
          ac.addListener("place_changed", () => {
            const loc = ac.getPlace()?.geometry?.location;
            if (loc) place(loc.lat(), loc.lng());
          });
        }

        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // When the city centre changes and no pin is placed yet, recentre the map.
  useEffect(() => {
    if (status !== "ready" || !center || value) return;
    mapRef.current?.setCenter(center);
    mapRef.current?.setZoom(13);
    markerRef.current?.setPosition(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, status]);

  // Sync the marker if the parent changes value externally (e.g. paste).
  useEffect(() => {
    if (status !== "ready" || !value || !markerRef.current) return;
    const cur = markerRef.current.getPosition();
    if (
      !cur ||
      Math.abs(cur.lat() - value.lat) > 1e-6 ||
      Math.abs(cur.lng() - value.lng) > 1e-6
    ) {
      markerRef.current.setPosition(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, status]);

  const applyLink = () => {
    const coords = extractCoords(linkInput);
    if (!coords) {
      setLinkError(
        "Couldn't find coordinates in that. Paste a Google Maps link or 'lat, lng'.",
      );
      return;
    }
    setLinkError(null);
    if (status === "ready") place(coords.lat, coords.lng);
    else onChangeRef.current(coords.lat, coords.lng);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {API_KEY && (
        <div className="relative">
          <Search className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          {/* Raw input: Google Autocomplete needs a direct DOM ref. */}
          <input
            ref={searchElRef}
            type="text"
            placeholder="Search a place, landmark or address…"
            disabled={disabled || status === "error"}
            className="h-11 w-full rounded-control border border-border-strong bg-surface pr-3.5 pl-9 text-sm text-foreground shadow-subtle placeholder:text-subtle-foreground focus-visible:border-ink-500 focus-visible:ring-3 focus-visible:ring-ink-600/20 focus-visible:outline-none"
            onKeyDown={(e) => {
              // Stop Enter from submitting the surrounding form while choosing.
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
      )}

      {/* Map surface */}
      {API_KEY ? (
        <div className="relative overflow-hidden rounded-media border border-border-strong bg-sand-200">
          <div ref={mapElRef} className="h-72 w-full" />
          {status !== "ready" && (
            <div className="absolute inset-0 flex items-center justify-center text-meta text-muted-foreground">
              {status === "error" ? (
                <span className="px-4 text-center text-danger-600">{errorMsg}</span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4" /> Scroll to load the map…
                </span>
              )}
            </div>
          )}
          <div className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-surface/90 px-2 py-1 text-overline text-muted-foreground shadow-subtle">
            {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Drop a pin"}
          </div>
        </div>
      ) : (
        <div className="rounded-media border border-warning-100 bg-warning-50 p-4 text-meta text-warning-700">
          Google Maps key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Paste a Google Maps
          link below, or enter coordinates, to set the location.
        </div>
      )}

      {/* Paste-a-link fallback (always available) */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-meta font-normal text-muted-foreground">
          Or paste a Google Maps link / “lat, lng”
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://maps.google.com/…  or  23.3600, 85.3300"
              className="pl-9"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={applyLink}
            disabled={disabled || !linkInput.trim()}
            className={cn(
              "rounded-control border border-border-strong px-3 text-sm font-medium",
              "hover:bg-surface-muted disabled:opacity-50",
            )}
          >
            Use
          </button>
        </div>
        {linkError && <span className="text-meta text-danger-600">{linkError}</span>}
        {!API_KEY && value && (
          <span className="text-meta text-success-700">
            Location set: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
