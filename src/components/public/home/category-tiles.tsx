import Link from "next/link";

/**
 * "What are you looking for?" — four category tiles with a soft tinted ground
 * and a simple inline line-art illustration (no photos, no stock art). Each
 * routes to the search page. Brand tints only (clay / ink / sand).
 */

const svgProps = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-12",
};

function FlatsArt() {
  return (
    <svg {...svgProps}>
      <rect x="7" y="10" width="18" height="30" rx="1.5" />
      <path d="M25 18h16v22H25" />
      <path d="M12 16h3M19 16h3M12 23h3M19 23h3M12 30h3M19 30h3" />
      <path d="M30 24h3M36 24h3M30 31h3M36 31h3" />
      <path d="M5 40h38" />
    </svg>
  );
}

function PlotsArt() {
  return (
    <svg {...svgProps}>
      <path d="M8 34 20 12l20 6-6 22z" strokeDasharray="3 3" />
      <circle cx="8" cy="34" r="1.6" />
      <circle cx="20" cy="12" r="1.6" />
      <circle cx="40" cy="18" r="1.6" />
      <circle cx="34" cy="40" r="1.6" />
    </svg>
  );
}

function HouseArt() {
  return (
    <svg {...svgProps}>
      <path d="M9 22 24 9l15 13" />
      <path d="M13 20v18h22V20" />
      <path d="M21 38V28h6v10" />
      <path d="M6 40h36" />
    </svg>
  );
}

function RentalsArt() {
  return (
    <svg {...svgProps}>
      <circle cx="17" cy="17" r="8" />
      <path d="M22.5 22.5 39 39" />
      <path d="M33 33l4-4M28 28l3-3" />
    </svg>
  );
}

const TILES = [
  { label: "Flats", href: "/search?q=flats", bg: "bg-ink-50", fg: "text-ink-700", Art: FlatsArt },
  { label: "Plots", href: "/search?q=plots", bg: "bg-clay-50", fg: "text-clay-700", Art: PlotsArt },
  {
    label: "Independent houses",
    href: "/search?q=independent%20house",
    bg: "bg-sand-100",
    fg: "text-sand-700",
    Art: HouseArt,
  },
  { label: "Rentals", href: "/search?q=rent", bg: "bg-clay-50", fg: "text-clay-700", Art: RentalsArt },
] as const;

export function CategoryTiles() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-page px-4 py-14 sm:px-6">
        <h2 className="text-display-sm">What are you looking for?</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TILES.map(({ label, href, bg, fg, Art }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-5 text-center shadow-card transition-shadow hover:shadow-lift"
            >
              <span className={`flex size-20 items-center justify-center rounded-full ${bg} ${fg}`}>
                <Art />
              </span>
              <span className="text-sm font-semibold text-ink-950">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
