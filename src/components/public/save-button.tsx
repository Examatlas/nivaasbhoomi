"use client";

import { Heart } from "lucide-react";

import { useSaved } from "@/components/public/saved-provider";
import { cn } from "@/lib/utils/cn";

/**
 * Heart / shortlist toggle. Account-based (buyer auth) — a logged-out tap is
 * routed to /login by the SavedProvider. Two visual variants: `overlay` (a
 * translucent chip that sits on a card photo) and `inline` (bordered button for
 * the detail header).
 */
export function SaveButton({
  listingId,
  variant = "overlay",
  className,
}: {
  listingId: string;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(listingId);

  function onClick(e: React.MouseEvent) {
    // Safe when rendered over/near a card link — never navigate on a save tap.
    e.preventDefault();
    e.stopPropagation();
    toggle(listingId);
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save property"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-control border px-3 py-2 text-sm font-medium transition-colors",
          saved
            ? "border-clay-300 bg-clay-50 text-clay-700"
            : "border-border bg-surface text-ink-800 hover:bg-surface-muted",
          className,
        )}
      >
        <Heart className={cn("size-4", saved && "fill-clay-600 text-clay-600")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(listingId)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save property"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-surface/95 shadow-subtle backdrop-blur-sm transition-colors hover:bg-surface",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-4.5 transition-colors",
          saved ? "fill-clay-600 text-clay-600" : "text-ink-700",
        )}
      />
    </button>
  );
}
