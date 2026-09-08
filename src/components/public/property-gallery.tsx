"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Camera, Expand, X } from "lucide-react";

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
 *
 * Tapping the main image (or the expand affordance) opens a FULLSCREEN lightbox
 * with keyboard navigation (← → to move, Esc to close), a photo counter, and
 * click-outside-to-close.
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
  // null = closed; a number is the index shown fullscreen.
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Order photos so the cover is first (hooks must run before any early return).
  const ordered =
    coverIndex > 0 && coverIndex < photos.length
      ? [photos[coverIndex]!, ...photos.filter((_, i) => i !== coverIndex)]
      : photos;

  const count = ordered.length;
  const openAt = useCallback((i: number) => setLightbox(i), []);
  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (delta: number) => {
      setLightbox((cur) => (cur == null ? cur : (cur + delta + count) % count));
    },
    [count],
  );

  // Keyboard nav + scroll lock while the lightbox is open.
  useEffect(() => {
    if (lightbox == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, close, step]);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-border bg-sand-200 text-sand-400">
        <Camera className="size-12" aria-hidden="true" />
      </div>
    );
  }

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
            <button
              key={p.publicId ?? p.url}
              type="button"
              onClick={() => openAt(i)}
              aria-label={`View photo ${i + 1} fullscreen`}
              className="relative aspect-[4/3] w-full shrink-0 cursor-zoom-in snap-center"
            >
              <Image
                src={photoUrl(p, "gallery")}
                alt={`${title} — photo ${i + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 720px"
                priority={i === 0}
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {/* Expand affordance — always present, so the fullscreen action is
            discoverable even on a single-photo listing. */}
        <button
          type="button"
          onClick={() => openAt(active)}
          aria-label="View fullscreen"
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink-950/60 px-2.5 py-1 text-overline font-medium text-white backdrop-blur-sm transition hover:bg-ink-950/80"
        >
          <Expand className="size-3.5" /> Fullscreen
        </button>

        {count > 1 && (
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
              onClick={() => scrollTo(Math.min(count - 1, active + 1))}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-ink-900 shadow-lift backdrop-blur transition hover:bg-surface disabled:opacity-40"
              disabled={active === count - 1}
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute right-3 bottom-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-overline font-medium text-white backdrop-blur-sm">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
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

      {/* ---------- Fullscreen lightbox ---------- */}
      {lightbox != null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/95"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — photo ${lightbox + 1} of ${count}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close fullscreen"
            className="absolute top-4 right-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          <span className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
            {lightbox + 1} / {count}
          </span>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => step(-1)}
                className="absolute left-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => step(1)}
                className="absolute right-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <div className="relative h-full max-h-[86vh] w-full max-w-6xl px-4">
            <Image
              key={ordered[lightbox]!.publicId ?? ordered[lightbox]!.url}
              src={photoUrl(ordered[lightbox]!, "gallery")}
              alt={`${title} — photo ${lightbox + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}
