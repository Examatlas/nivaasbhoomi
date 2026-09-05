import { Loader2 } from "lucide-react";

/** Shown while a dynamic /admin/* page loads, so navigation never flashes blank. */
export default function AdminLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );
}
