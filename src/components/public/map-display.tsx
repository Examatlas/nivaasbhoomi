"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { loadGoogleMaps } from "@/lib/maps/loader";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Read-only Google Map showing a single listing pin. Rendered only after the
 * lazy wrapper mounts it (on scroll), and the SDK loads on mount - so it never
 * runs on the server and never loads Maps until the user reaches it.
 */
export function MapDisplay({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!API_KEY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    let cancelled = false;
    loadGoogleMaps(API_KEY)
      .then((google) => {
        if (cancelled || !mapElRef.current) return;
        const center = { lat, lng };
        const map = new google.maps.Map(mapElRef.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
        new google.maps.Marker({ map, position: center, title: label });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, label]);

  if (failed) {
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-72 w-full items-center justify-center gap-2 rounded-card border border-border bg-surface-muted text-sm font-medium text-ink-700 hover:bg-sand-200"
      >
        <MapPin className="size-5 text-clay-500" /> View location on Google Maps
      </a>
    );
  }

  return <div ref={mapElRef} className="h-72 w-full rounded-card border border-border" />;
}
