import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/**
 * Public site footer. Calm, text-first, no ad slots - the layout is allowed to
 * breathe because there is nothing to monetise in the chrome. Popular-city and
 * property-type link columns are the real SEO internal-linking surface; they
 * are stubbed here in Phase 0 and filled from live location data later.
 */
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Popular Cities",
    links: [
      { href: "/", label: "Ranchi" },
      { href: "/", label: "Patna" },
      { href: "/", label: "Jamshedpur" },
      { href: "/", label: "Dhanbad" },
    ],
  },
  {
    title: "Property Types",
    links: [
      { href: "/", label: "Flats" },
      { href: "/", label: "Independent Houses" },
      { href: "/", label: "Plots" },
      { href: "/", label: "Commercial" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/blog", label: "Guides" },
      { href: "/tools", label: "Calculators" },
      { href: "/dealer/login", label: "List your property" },
      { href: "/", label: "About" },
      { href: "/", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto max-w-page px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <Logo href="/" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Verified property across India, contacted directly on WhatsApp. No
              spam calls, no hidden numbers.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} className="flex flex-col gap-3">
              <h2 className="text-overline text-subtle-foreground uppercase">{col.title}</h2>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-meta text-subtle-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} NivaasBhoomi. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
