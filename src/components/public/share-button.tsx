"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Share control. Uses the native Web Share sheet where available (mobile), and
 * falls back to copying the link to the clipboard with a brief "Copied" state.
 * The absolute URL is built from window.location.origin at click time, so it is
 * always the live domain (these pages are ISR/static — no baked-in origin).
 *
 * `overlay` = round translucent chip on a card photo; `inline` = bordered button.
 */
export function ShareButton({
  path,
  title,
  variant = "overlay",
  className,
}: {
  path: string;
  title: string;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function onClick(e: React.MouseEvent) {
    // Safe near a card link — a share tap must never navigate.
    e.preventDefault();
    e.stopPropagation();
    void share();
  }

  async function share() {
    const url =
      (typeof window !== "undefined" ? window.location.origin : "") + path;
    // Native share sheet first (mobile). A user-cancelled share throws
    // AbortError — swallow it, don't fall through to a copy.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing more we can safely do */
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Share this property"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-surface-muted",
          className,
        )}
      >
        {copied ? <Check className="size-4 text-success-700" /> : <Share2 className="size-4" />}
        {copied ? "Link copied" : "Share"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share this property"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-surface/95 shadow-subtle backdrop-blur-sm transition-colors hover:bg-surface",
        className,
      )}
    >
      {copied ? (
        <Check className="size-4.5 text-success-700" />
      ) : (
        <Share2 className="size-4.5 text-ink-700" />
      )}
    </button>
  );
}
