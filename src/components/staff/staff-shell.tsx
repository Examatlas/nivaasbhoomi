import Link from "next/link";
import { LayoutDashboard, List, KeyRound } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { StaffSignOutButton } from "@/components/staff/staff-sign-out-button";

const NAV = [
  { href: "/staff", label: "My dealers", icon: LayoutDashboard },
  { href: "/staff/listings", label: "Listings", icon: List },
  { href: "/staff/access-requests", label: "Access requests", icon: KeyRound },
];

/**
 * Staff panel shell: top bar + nav. Mirrors the dealer shell. Staff see only a
 * scoped slice of the platform — their own dealers and the listings under them —
 * so the nav is deliberately small (no global settings, rates, or automation).
 */
export function StaffShell({
  children,
  active,
  name,
}: {
  children: React.ReactNode;
  active?: string;
  name?: string;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-4 sm:px-6">
          <Logo href="/staff" />
          <span className="rounded-full bg-ink-50 px-2 py-0.5 text-overline font-semibold text-ink-700 uppercase">
            Staff
          </span>
          <div className="ml-auto flex items-center gap-3">
            {name && (
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {name}
              </span>
            )}
            <StaffSignOutButton />
          </div>
        </div>
        <nav className="mx-auto max-w-page overflow-x-auto px-2 sm:px-4">
          <ul className="flex min-w-max items-center gap-1 pb-2">
            {NAV.map((item) => {
              const isActive = active === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      "inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition-colors " +
                      (isActive
                        ? "bg-ink-50 text-ink-900"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground")
                    }
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-page px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
