import { PropertyCard } from "@/components/public/property-card";
import type { ListingCardData } from "@/types/listing";

/**
 * Responsive grid of PropertyCards. The first two cards get priority image
 * loading (above the fold) to help LCP on mobile.
 */
export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l, i) => (
        <PropertyCard key={l.id} listing={l} priority={i < 2} />
      ))}
    </div>
  );
}
