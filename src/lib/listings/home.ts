import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { getCityListings } from "@/lib/listings/query";
import type { ActiveCity } from "@/lib/locations/geo";
import type { ListingCardData } from "@/types/listing";

export interface HomeCity extends ActiveCity {
  id: string;
  listings: ListingCardData[];
}

export interface HomeStats {
  /** Active (launched) cities. */
  citiesLive: number;
  /** Approved listings live on the site (real DB count). */
  totalListings: number;
}

export interface HomeData {
  cities: HomeCity[];
  stats: HomeStats;
}

/** Active cities with coordinates — the city switcher + nearest-city math. */
export async function getActiveCitiesGeo(): Promise<ActiveCity[]> {
  await connectDB();
  const rows = await City.find(
    { isActive: true },
    { name: 1, slug: 1, lat: 1, lng: 1 },
  )
    .sort({ tier: 1, name: 1 })
    .lean();
  return rows.map((c) => ({
    name: c.name,
    slug: c.slug,
    lat: typeof c.lat === "number" ? c.lat : null,
    lng: typeof c.lng === "number" ? c.lng : null,
  }));
}

/**
 * Everything the home page needs, city-aware: each active city with its newest
 * listings, plus honest DB counts for the stats band. Fetched once server-side
 * (ISR) and handed to the client so the page stays static — the client only
 * picks WHICH city's slice to show based on the resolved city.
 */
export async function getHomeData(perCity = 6): Promise<HomeData> {
  await connectDB();
  const activeCities = await City.find(
    { isActive: true },
    { name: 1, slug: 1, lat: 1, lng: 1 },
  )
    .sort({ tier: 1, name: 1 })
    .lean();

  const cities: HomeCity[] = await Promise.all(
    activeCities.map(async (c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      lat: typeof c.lat === "number" ? c.lat : null,
      lng: typeof c.lng === "number" ? c.lng : null,
      listings: await getCityListings(String(c._id), c.name, perCity),
    })),
  );

  const totalListings = await Listing.countDocuments({
    status: "approved",
    slug: { $type: "string" },
  });

  return { cities, stats: { citiesLive: activeCities.length, totalListings } };
}
