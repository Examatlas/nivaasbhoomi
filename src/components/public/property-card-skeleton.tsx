import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for PropertyCard. Mirrors the real card's box exactly so
 * a grid of these swaps to real content with zero layout shift (CLS < 0.1).
 */
export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <div className="flex gap-3 border-t border-border pt-3">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
        <Skeleton className="mt-1 h-11 w-full rounded-control" />
      </div>
    </div>
  );
}
