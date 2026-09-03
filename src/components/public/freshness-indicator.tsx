import { getFreshness, type FreshnessLevel } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

/**
 * Freshness indicator - a coloured dot plus relative time ("2 days ago").
 * Buyers on competitor sites constantly hit dead, months-old listings; showing
 * age honestly on every card is a deliberate trust move. Colour comes only from
 * the dot so it never competes with the WhatsApp green CTA.
 */
const DOT: Record<FreshnessLevel, string> = {
  fresh: "bg-success-500",
  recent: "bg-ink-400",
  ageing: "bg-sand-400",
  stale: "bg-warning-500",
};

export function FreshnessIndicator({
  refreshedAt,
  className,
}: {
  refreshedAt: Date | string;
  className?: string;
}) {
  const { label, level } = getFreshness(refreshedAt);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-meta text-muted-foreground", className)}
    >
      <span
        className={cn("size-1.5 rounded-full", DOT[level], level === "fresh" && "animate-pulse")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
