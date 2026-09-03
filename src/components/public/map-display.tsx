"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { loadGoogleMaps } from "@/lib/maps/loader";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Read-only Google Map showing a single listing pin. Rendered only after the
 * lazy wrapper mounts it (on scroll), and the SDK loads on mount - so it never
 * runs on the server and never loads Maps until the user reaches it.
 *
 * A Maps issue NEVER breaks the page: any load/script error, or a Google auth
 * failure (invalid key, Maps JavaScript API not enabled -> ApiNotActivatedMap
 * Error, referrer/billing problems - all reported via window.gm_authFailure),
 * swaps this component to a "View on Google Maps" link fallback.
 */
export function MapDisplay({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Dev-only visibility into whether the public key is wired (masked).
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[map] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY present:",
        Boolean(API_KEY),
        API_KEY ? `(length ${API_KEY.length}, ends …${API_KEY.slice(-4)})` : "(missing)",
      );
    }

    if (!API_KEY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }

    let cancelled = false;

    // Google calls this global on ANY auth/activation failure (including
    // ApiNotActivatedMapError). Fall back to the link instead of the overlay.
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      if (!cancelled) setFailed(true);
    };

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
      window.gm_authFailure = previous;
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
