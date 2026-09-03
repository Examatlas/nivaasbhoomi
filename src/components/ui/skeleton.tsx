import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Skeleton. Shimmer placeholder for loading states. Reserving the exact final
 * dimensions here is what keeps CLS < 0.1 (DEV-SPEC.txt Core Web Vitals): the
 * skeleton occupies the same box the real content will, so nothing shifts when
 * data arrives. Respects prefers-reduced-motion via the shared keyframe rule.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-media", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
