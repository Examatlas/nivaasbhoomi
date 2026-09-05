import Link from "next/link";
import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo href="/" />
      <div>
        <p className="text-display-sm font-semibold text-ink-950">Page not found</p>
        <p className="mt-2 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, or it may have moved. Let&apos;s
          get you back on track.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/search">Browse properties</Link>
        </Button>
      </div>
    </div>
  );
}
