import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Logo } from "@/components/shared/logo";

/**
 * Admin route-group layout. Admin pages are client-side and dynamic (Section 9),
 * with their own chrome - deliberately NOT the public header/footer.
 *
 * AUTH: not built until Phase 2. The API routes under /api/admin/* are guarded
 * by the requireAdmin() stub (denies in production, allows in dev). This banner
 * makes the unguarded-in-dev state impossible to miss.
 */
export const dynamic = "force-dynamic";

// Only Locations exists in Phase 1; Dashboard/Listings/Dealers arrive in their
// own phases and are added here then to avoid dead links now.
const NAV = [{ href: "/admin/locations", label: "Locations" }];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
          <Link href="/admin/locations" className="flex items-center gap-2 outline-none">
            <Logo showWordmark={false} />
            <span className="font-display text-sm font-bold tracking-tight text-ink-950">
              Admin
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-control px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {isDev && (
        <div className="flex items-center gap-2 border-b border-warning-100 bg-warning-50 px-4 py-2 text-meta text-warning-700 sm:px-6">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            <strong>Dev mode:</strong> admin auth is stubbed (Phase 2). These screens and
            the <code>/api/admin/*</code> routes are open in development and denied in
            production until real auth is wired.
          </span>
        </div>
      )}

      <main className="flex-1">{children}</main>
    </div>
  );
}
