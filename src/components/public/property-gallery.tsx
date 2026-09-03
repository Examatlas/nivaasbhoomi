"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Camera } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { photoUrl } from "@/lib/media/transforms";
import type { ListingPhoto } from "@/types/listing";

/**
 * Property photo gallery (DEV-SPEC.txt Sections 10, 13).
 *
 * A native scroll-snap track: swipeable on mobile with zero JS gesture code
 * (tiny bundle), arrow + thumbnail navigation on desktop. Images use the
 * Cloudinary gallery transform (1200x900); the cover loads with priority for
 * LCP, the rest are lazy.
 */
export function PropertyGallery({
  photos,
  coverIndex = 0,
  title,
}: {
  photos: ListingPhoto[];
  coverIndex?: number;
  title: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-border bg-sand-200 text-sand-400">
        <Camera className="size-12" aria-hidden="true" />
      </div>
    );
  }

  // Order photos so the cover is first.
  const ordered =
    coverIndex > 0 && coverIndex < photos.length
      ? [photos[coverIndex]!, ...photos.filter((_, i) => i !== coverIndex)]
      : photos;

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setActive(index);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-card border border-border bg-sand-200">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ordered.map((p, i) => (
            <div key={p.publicId ?? p.url} className="relative aspect-[4/3] w-full shrink-0 snap-center">
              <Image
                src={photoUrl(p, "gallery")}
                alt={`${title} — photo ${i + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 720px"
                priority={i === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {ordered.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => scrollTo(Math.max(0, active - 1))}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-ink-900 shadow-lift backdrop-blur transition hover:bg-surface disabled:opacity-40"
              disabled={active === 0}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => scrollTo(Math.min(ordered.length - 1, active + 1))}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-ink-900 shadow-lift backdrop-blur transition hover:bg-surface disabled:opacity-40"
              disabled={active === ordered.length - 1}
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute right-3 bottom-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-overline font-medium text-white backdrop-blur-sm">
              {active + 1} / {ordered.length}
            </span>
          </>
        )}
      </div>

      {ordered.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ordered.map((p, i) => (
            <button
              key={`thumb-${p.publicId ?? p.url}`}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to photo ${i + 1}`}
              className={cn(
                "relative aspect-[4/3] h-16 shrink-0 overflow-hidden rounded-media border-2 transition",
                i === active ? "border-ink-600" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={photoUrl(p, "cardThumb")}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
