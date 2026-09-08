"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Sticky in-page section nav for the property detail page (Overview / Amenities
 * / Location / Dealer). Sits just under the site header; on mobile it scrolls
 * horizontally. Clicking scrolls to the section (each target has scroll-margin so
 * it lands below the sticky bars); an IntersectionObserver highlights the section
 * currently in view. Purely enhances an already-rendered page — the anchors work
 * even without JS.
 */
export interface Section {
  id: string;
  label: string;
}

export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry nearest the top of the viewport that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Bias the active zone to the upper third so the highlight matches where
      // the reader's eye is, not the exact viewport centre.
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function go(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Reflect the section in the URL without a jump.
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <ul className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => go(e, s.id)}
              className={cn(
                "inline-flex whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active === s.id
                  ? "border-clay-600 text-ink-950"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
