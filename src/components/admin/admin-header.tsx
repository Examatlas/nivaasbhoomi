"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

const NAV = [
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/dealers", label: "Dealers" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/automation", label: "Automation" },
];

/**
 * Admin top bar. Hidden on the login page (the only admin route without a
 * session). Carries the logout action.
 */
export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return null;

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore - clear client state and go to login regardless
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
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
        <Button variant="ghost" size="sm" className="ml-auto" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>
    </header>
  );
}
