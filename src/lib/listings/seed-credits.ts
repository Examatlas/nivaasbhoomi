/**
 * Photographer attribution for seed-listing photos.
 *
 * Pexels asks that photos carry a photographer credit. `seed:fetch-images`
 * records each photo's photographer in `src/data/seed-image-credits.json`; this
 * maps a seed listing (by its title) to its cover photo's photographer so the
 * property page can render "Photo: <photographer> / Pexels".
 *
 * The JSON is statically imported (committed alongside the seed data), so this
 * works at build/runtime without touching the DB or re-importing listings.
 */
import creditsData from "@/data/seed-image-credits.json";

interface RawCredit {
  listingTitle?: string;
  photographer?: string;
}

// listingTitle -> first (cover) photographer for that listing.
const byTitle = new Map<string, string>();
for (const c of creditsData as RawCredit[]) {
  if (c.listingTitle && c.photographer && !byTitle.has(c.listingTitle)) {
    byTitle.set(c.listingTitle, c.photographer);
  }
}

/** Cover-photo photographer for a seed listing title, or null if not credited. */
export function seedPhotoCredit(title: string): string | null {
  return byTitle.get(title) ?? null;
}
