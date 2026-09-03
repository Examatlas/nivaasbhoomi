import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/public/mobile-nav";

const NAV_LINKS = [
  { href: "/", label: "Buy" },
  { href: "/", label: "Rent" },
  { href: "/blog", label: "Guides" },
  { href: "/dealer/login", label: "For Dealers" },
];

/**
 * Public site header. Server component; the only client code is <MobileNav>.
 * Sticky, thin, and quiet - it must never crowd the photo-forward content
 * below it. One primary action ("List your property") on desktop.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 outline-none" aria-label="NivaasBhoomi home">
          <Logo />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-control px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/dealer/login">Login</Link>
          </Button>
          <Button asChild variant="primary" size="sm" className="hidden md:inline-flex">
            <Link href="/dealer/login">List your property</Link>
          </Button>
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
