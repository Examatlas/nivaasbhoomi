"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/track";

interface CityOption {
  name: string;
  slug: string;
}

/**
 * Home search / city selector. Type a city and pick from the active-city list,
 * or press Search to go to the top match - routes to /[city]. Locality-level
 * search arrives with a full search results view later.
 */
export function HomeSearch({ cities }: { cities: CityOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cities.slice(0, 6);
    return cities.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 6);
  }, [q, cities]);

  const goTo = (slug: string) => router.push(`/${slug}`);
  const submit = () => {
    const term = q.trim();
    if (term) trackEvent("search", { query: term });
    // Exact city name wins; a partial that matches exactly one city goes there;
    // otherwise fall through to the site-wide search results view.
    const exact = cities.find((c) => c.name.toLowerCase() === term.toLowerCase());
    if (exact) return goTo(exact.slug);
    if (term && matches.length === 1) return goTo(matches[0]!.slug);
    if (term) return router.push(`/search?q=${encodeURIComponent(term)}`);
    if (matches[0]) goTo(matches[0].slug);
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex flex-col gap-2 rounded-sheet border border-border bg-surface p-2 shadow-card sm:flex-row">
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={
              cities.length
                ? "Search city, locality or keyword…"
                : "No cities live yet — check back soon"
            }
            disabled={cities.length === 0}
            className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-subtle-foreground"
            aria-label="Search a city"
          />
        </div>
        <Button size="lg" className="sm:w-auto" onClick={submit} disabled={cities.length === 0}>
          Search
        </Button>
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-card border border-border bg-surface text-left shadow-overlay">
          {matches.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goTo(c.slug)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-muted"
              >
                <MapPin className="size-4 text-clay-500" /> {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
