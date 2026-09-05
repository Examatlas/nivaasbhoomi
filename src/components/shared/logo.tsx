import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * NivaasBhoomi wordmark + mark. The mark is a house roofline resolving into a
 * horizon line - "nivaas" (home) meeting "bhoomi" (land). Pure inline SVG, so
 * it costs nothing and stays crisp on any DPI. Ink by default; the roof carries
 * the clay accent so the brand's two colours are present in the logo itself.
 *
 * Pass `href` (usually "/") to make the whole logo + wordmark a link home -
 * standard header behaviour. Omit it where the logo is already inside a link.
 */
export function Logo({
  className,
  showWordmark = true,
  href,
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label="NivaasBhoomi"
      >
        {/* roof / land */}
        <path
          d="M4 15 L16 5 L28 15"
          fill="none"
          stroke="var(--color-clay-600)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* house body */}
        <path
          d="M7 14 V25 H25 V14"
          fill="none"
          stroke="var(--color-ink-900)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* horizon / doorway */}
        <path d="M13 25 V19 H19 V25" fill="var(--color-ink-900)" />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-ink-950">
          Nivaas<span className="text-clay-600">Bhoomi</span>
        </span>
      )}
    </>
  );

  const base = "inline-flex items-center gap-2";

  if (href) {
    return (
      <Link
        href={href}
        aria-label="NivaasBhoomi home"
        className={cn(base, "outline-none", className)}
      >
        {inner}
      </Link>
    );
  }

  return <span className={cn(base, className)}>{inner}</span>;
}
