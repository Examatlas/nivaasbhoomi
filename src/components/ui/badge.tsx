import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Badge. Small status/label pill. Trust badges (verified, documents-checked)
 * and listing meta (furnishing, freshness) all render through this so the
 * vocabulary of chips stays consistent across the site.
 *
 * The `verified` tone is a soft green *tint* with dark green text (not a solid
 * fill) so it reads clearly at any size and stays visually distinct from the
 * saturated WhatsApp-green CTA, which remains the only solid green on the site.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border border-border bg-surface-muted text-sand-700",
        ink: "border border-ink-100 bg-ink-50 text-ink-800",
        clay: "border border-clay-100 bg-clay-50 text-clay-800",
        verified: "border border-success-100 bg-success-50 text-success-700",
        success: "border border-success-100 bg-success-50 text-success-700",
        warning: "border border-warning-100 bg-warning-50 text-warning-700",
        danger: "border border-danger-100 bg-danger-50 text-danger-700",
        outline: "border border-border-strong bg-surface text-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-overline uppercase [&_svg]:size-3",
        md: "px-2.5 py-1 text-meta [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export { badgeVariants };
