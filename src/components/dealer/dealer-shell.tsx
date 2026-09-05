import Link from "next/link";
import {
  LayoutDashboard,
  List,
  PlusCircle,
  Inbox,
  BadgeCheck,
  MapPin,
  Sparkles,
} from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { SignOutButton } from "@/components/dealer/sign-out-button";

const NAV = [
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/listings", label: "My listings", icon: List },
  { href: "/dealer/listings/new", label: "Add listing", icon: PlusCircle },
  { href: "/dealer/leads", label: "Leads", icon: Inbox },
  { href: "/dealer/verification", label: "Verification", icon: BadgeCheck },
  { href: "/dealer/profile", label: "Coverage & profile", icon: MapPin },
  { href: "/dealer/automation", label: "Automation", icon: Sparkles },
];

/**
 * Dealer panel shell: top bar + responsive nav. Mobile-first - the nav is a
 * horizontal scroller on phones and a sidebar-ish row on wider screens.
 */
export function DealerShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-4 sm:px-6">
          <Logo href="/" />
          <span className="rounded-full bg-ink-50 px-2 py-0.5 text-overline font-semibold text-ink-700 uppercase">
            Dealer
          </span>
          <div className="ml-auto">
            <SignOutButton />
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
