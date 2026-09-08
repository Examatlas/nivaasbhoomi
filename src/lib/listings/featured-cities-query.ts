import { cache } from "react";
import type { Types } from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Listing } from "@/lib/db/models/Listing";
import { FEATURED_CITIES, type FeaturedCity } from "@/config/featured-cities";

/**
 * Featured cities whose /[city] page ACTUALLY renders (200) — the render-time
 * guard so we never show a 404 link (Part A4). A featured city is shown only
 * when it is active OR has at least one approved seed listing — exactly the
 * condition resolveDisplayCity() renders on. Cached per request; pages using it
 * are ISR, so it's one cheap query per revalidation.
 */
export const getVisibleFeaturedCities = cache(async (): Promise<FeaturedCity[]> => {
  try {
    await connectDB();
    const slugs = FEATURED_CITIES.map((c) => c.slug);
    const cities = await City.find({ slug: { $in: slugs } }, { slug: 1, isActive: 1 }).lean();

    const renderable = new Set<string>();
    const inactiveIds: Types.ObjectId[] = [];
    for (const c of cities) {
      if (c.isActive) renderable.add(c.slug);
      else inactiveIds.push(c._id as Types.ObjectId);
    }

    // Inactive featured cities render only if they carry seed listings.
    if (inactiveIds.length > 0) {
      const seededCityIds = new Set(
        (
          await Listing.distinct("cityId", {
            cityId: { $in: inactiveIds },
            status: "approved",
            isSeed: true,
          })
        ).map(String),
      );
      for (const c of cities) {
        if (!c.isActive && seededCityIds.has(String(c._id))) renderable.add(c.slug);
      }
    }

    // Preserve the config's order + display names.
    return FEATURED_CITIES.filter((c) => renderable.has(c.slug));
  } catch {
    return [];
  }
});
