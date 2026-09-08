import Image from "next/image";
import Link from "next/link";
import { BedDouble, Maximize, MapPin, Sofa, Images, Camera, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PropertyContactButton } from "@/components/public/property-contact-button";
import { resolveContactMode } from "@/lib/leads/contact-mode";
import { VerificationBadge } from "@/components/public/verification-badge";
import { FreshnessIndicator } from "@/components/public/freshness-indicator";
import { SaveButton } from "@/components/public/save-button";
import { ShareButton } from "@/components/public/share-button";
import { possessionLabel } from "@/lib/utils/listing-format";
import { cn } from "@/lib/utils/cn";
import {
  formatArea,
  formatBhk,
  formatFurnishing,
  formatListingPrice,
  formatPropertyType,
} from "@/lib/utils/price";
import { photoUrl } from "@/lib/media/transforms";
import type { ListingCardData } from "@/types/listing";

/**
 * PropertyCard - the most important component on the site.
 *
 * Design intent (beat 99acres / MagicBricks / Housing.com):
 *  - Photo-forward: a large 4:3 image is the hero; on competitor cards the
 *    photo is a cramped thumbnail. Ours fills the card width and uses next/image
 *    so it is responsive and lazy by default.
 *  - Calm chrome: price and locality get the type hierarchy; specs are a quiet
 *    single row of icon+value, not a wall of grey pills.
 *  - One clear action: a single WhatsApp CTA. No "call", no "get phone number"
 *    popup, no competing buttons. Green appears exactly once per card.
 *  - Honest trust signals: freshness date and verification tier are shown
 *    plainly instead of hidden.
 *
 * Renders as a server component - the only interactivity is two plain links and
 * one wa.me anchor, so a page of these ships zero component JavaScript.
 */
export function PropertyCard({
  listing,
  priority = false,
  className,
}: {
  listing: ListingCardData;
  /** Set true only for above-the-fold cards so next/image preloads them (LCP). */
  priority?: boolean;
  className?: string;
}) {
  const {
    id,
    slug,
    title,
    purpose,
    propertyType,
    isCntLand,
    price,
    bhk,
    area,
    areaUnit = "sq.ft.",
    furnishing,
    possessionStatus,
    projectName,
    localityName,
    cityName,
    photo,
    photoCount,
    badges,
    verificationTier,
    refreshedAt,
    zenithConnected,
    zenithNumber,
    featured,
    isSeed,
  } = listing;

  const href = `/property/${slug}`;
  const { primary: priceLabel, suffix: priceSuffix } = formatListingPrice(purpose, price);
  const possession = possessionLabel(possessionStatus);
  // Card thumbnail delivered via the Cloudinary card-thumb transform (S14).
  const coverSrc = photo ? photoUrl(photo, "cardThumb") : null;

  const isPlot = propertyType === "plot";
  const trustCount =
    Number(badges.documentsChecked) +
    Number(badges.photosVerified) +
    Number(badges.siteVisited);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card",
        "transition-[box-shadow,transform,border-color] duration-200 ease-out-soft",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        "focus-within:border-ink-300 focus-within:shadow-lift",
        className,
      )}
    >
      {/* ---------- Media (hero) ---------- */}
      <Link
        href={href}
        className="relative block aspect-[4/3] overflow-hidden bg-sand-200 outline-none"
        aria-label={title}
      >
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={photo?.alt ?? title}
            fill
            // Widths match the real column layout so we never download an
            // oversized image on a phone.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sand-400">
            <Camera className="size-10" aria-hidden="true" />
          </div>
        )}

        {/* Legibility scrim only at the very bottom, so overlays read without
            dimming the photo the way competitor cards do. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950/45 to-transparent" />

        {/* Top-left overlay: purpose/featured/CNT/possession + verification.
            The left group wraps on a narrow card; the action cluster (a sibling
            of this Link, below) stays pinned top-right and never overlaps. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start gap-2 pr-16">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              tone={purpose === "rent" ? "clay" : "ink"}
              className="bg-surface/95 shadow-subtle backdrop-blur-sm"
            >
              {purpose === "rent" ? "For Rent" : "For Sale"}
            </Badge>
            {featured && (
              <Badge tone="clay" className="shadow-subtle">
                Featured
              </Badge>
            )}
            {isCntLand && (
              <Badge tone="neutral" className="bg-surface/95 shadow-subtle backdrop-blur-sm">
                CNT
              </Badge>
            )}
            {possession && (
              <Badge
                tone={possessionStatus === "ready-to-move" ? "success" : "neutral"}
                className="bg-surface/95 shadow-subtle backdrop-blur-sm"
              >
                {possession}
              </Badge>
            )}
            {verificationTier >= 1 && (
              <VerificationBadge tier={verificationTier} size="sm" className="shrink-0" />
            )}
          </div>
        </div>

        {/* Photo count, bottom-right - promises a real gallery, not one photo. */}
        {photoCount > 1 && (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-ink-950/70 px-2 py-0.5 text-overline font-medium text-white backdrop-blur-sm">
            <Images className="size-3" aria-hidden="true" />
            {photoCount}
          </span>
        )}
      </Link>

      {/* Action cluster — sibling of the media Link (never nested in the anchor)
          so a save/share tap can't navigate. Pinned top-right of the photo. */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <ShareButton path={href} title={title} />
        <SaveButton listingId={id} />
      </div>

      {/* ---------- Body ---------- */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Price + freshness. Price is the single loudest element. */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-price text-ink-950 tabular">
            {priceLabel}
            {priceSuffix && (
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                {priceSuffix}
              </span>
            )}
          </p>
          <FreshnessIndicator refreshedAt={refreshedAt} className="mt-1 shrink-0" />
        </div>

        {/* Title */}
        <Link href={href} className="outline-none">
          <h3 className="line-clamp-2 text-base leading-snug font-semibold text-ink-950 transition-colors group-hover:text-ink-700">
            {title}
          </h3>
        </Link>

        {/* Project / society name - a quiet line under the title. */}
        {projectName && (
          <p className="-mt-1 line-clamp-1 text-meta text-muted-foreground">{projectName}</p>
        )}

        {/* Locality */}
        <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-clay-500" aria-hidden="true" />
          <span className="line-clamp-1">
            {localityName}, {cityName}
          </span>
        </p>

        {/* Specs row - quiet icon+value trio, divided by hairlines. */}
        <div className="flex items-center gap-3 border-t border-border pt-3 text-meta text-foreground">
          {bhk && !isPlot && (
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="size-4 text-sand-500" aria-hidden="true" />
              <span className="font-medium">{formatBhk(bhk)}</span>
            </span>
          )}
          {area ? (
            <span className="inline-flex items-center gap-1.5">
              <Maximize className="size-4 text-sand-500" aria-hidden="true" />
              <span className="tabular font-medium">{formatArea(area, areaUnit)}</span>
            </span>
          ) : null}
          {furnishing && !isPlot && (
            <span className="inline-flex items-center gap-1.5">
              <Sofa className="size-4 text-sand-500" aria-hidden="true" />
              <span className="font-medium">{formatFurnishing(furnishing)}</span>
            </span>
          )}
          {isPlot && (
            <span className="font-medium text-muted-foreground">
              {formatPropertyType(propertyType)}
            </span>
          )}
        </div>

        {/* Trust line - only shown when at least one check has passed. */}
        {trustCount > 0 && (
          <p className="inline-flex items-center gap-1.5 text-meta text-success-700">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">
              {[
                badges.documentsChecked && "Documents checked",
                badges.photosVerified && "Photos verified",
                badges.siteVisited && "Site visited",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
        )}

        {/* Single action. Pushed to the bottom so every card's CTA aligns.
            Seed (display-only) listings have NO contact CTA — just a neutral
            label, matching the detail page (B6). */}
        <div className="mt-auto pt-1">
          {isSeed ? (
            <p className="text-meta text-subtle-foreground">Demo listing — for reference only</p>
          ) : (
            <PropertyContactButton
              listingId={id}
              listingTitle={title}
              listingSlug={slug}
              mode={resolveContactMode({ zenithConnected })}
              whatsappNumber={zenithNumber ?? undefined}
              triggerLabel="Contact Us"
              block
              size="md"
            />
          )}
        </div>
      </div>
    </article>
  );
}
