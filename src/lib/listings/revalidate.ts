import { revalidatePath } from "next/cache";

import { connectDB } from "@/lib/db/connect";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * After a dealer's Zenith connection changes, revalidate the public pages that
 * render their listing cards / detail so the WhatsApp-vs-Contact-Us button
 * doesn't stay stale for the ISR TTL. Covers: home, the dealer's property detail
 * pages, their city + locality pages, and their agent profile. Filter pages
 * (`/<city>/<locality>/<filter>`) are combinatorial and not enumerable, so they
 * self-heal within the existing 3600s ISR window.
 *
 * Best-effort: any failure is logged, never thrown into the connect/disconnect
 * flow.
 */
export async function revalidateDealerPublicPages(dealerId: string): Promise<void> {
  try {
    await connectDB();
    const [listings, dealer] = await Promise.all([
      Listing.find(
        { dealerId, status: "approved" },
        { slug: 1, cityId: 1, localityId: 1 },
      ).lean(),
      Dealer.findById(dealerId, { slug: 1 }).lean(),
    ]);

    const cityIds = [...new Set(listings.map((l) => String(l.cityId)).filter(Boolean))];
    const localityIds = [
      ...new Set(listings.map((l) => String(l.localityId)).filter(Boolean)),
    ];
    const [cities, localities] = await Promise.all([
      City.find({ _id: { $in: cityIds } }, { slug: 1 }).lean(),
      Locality.find({ _id: { $in: localityIds } }, { slug: 1 }).lean(),
    ]);
    const citySlug = new Map(cities.map((c) => [String(c._id), c.slug]));
    const localitySlug = new Map(localities.map((l) => [String(l._id), l.slug]));

    const paths = new Set<string>(["/"]);
    for (const l of listings) {
      if (l.slug) paths.add(`/property/${l.slug}`);
      const cs = citySlug.get(String(l.cityId));
      const ls = localitySlug.get(String(l.localityId));
      if (cs) paths.add(`/${cs}`);
      if (cs && ls) paths.add(`/${cs}/${ls}`);
    }
    if (dealer?.slug) paths.add(`/agent/${dealer.slug}`);

    for (const p of paths) revalidatePath(p);
  } catch (e) {
    console.error("[zenith] revalidateDealerPublicPages failed:", e);
  }
}
