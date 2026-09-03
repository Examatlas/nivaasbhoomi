"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

// ssr:false so the heavy map is never server-rendered (Section 10 CWV).
const MapDisplay = dynamic(
  () => import("@/components/public/map-display").then((m) => m.MapDisplay),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 w-full items-center justify-center rounded-card border border-border bg-surface-muted text-meta text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

/**
 * Lazily mounts the read-only map only once it scrolls into view, so the Google
 * Maps SDK is fetched on demand (quota-safe) and never during SSR.
 */
export function PropertyMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <MapDisplay lat={lat} lng={lng} label={label} />
      ) : (
        <div className="flex h-72 w-full items-center justify-center gap-2 rounded-card border border-border bg-surface-muted text-meta text-muted-foreground">
          <MapPin className="size-4" /> Map loads as you scroll
        </div>
      )}
    </div>
  );
}
