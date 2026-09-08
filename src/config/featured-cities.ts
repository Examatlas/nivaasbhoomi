/**
 * Pan-India featured cities — the "Popular Cities" positioning list shown on the
 * homepage and footer. This is BRAND positioning (coverage across India), not a
 * signal of which cities are live: each links to /[city], which renders once the
 * city has listings (real or seed) and 404s until then.
 *
 * Slugs must match City.slug in the DB. Keep Ranchi in the list (home base), but
 * the framing is pan-India, not Ranchi-only.
 */
export interface FeaturedCity {
  name: string;
  slug: string;
}

// Slugs are the ACTUAL City.slug values in the DB (verified against the 754
// seeded cities). A few differ from the plain city name because the pincode
// dataset uses the district name: Delhi → "new-delhi", Bengaluru →
// "bengaluru-urban", Ahmedabad → "ahmadabad". getVisibleFeaturedCities() also
// filters against the DB at render time, so a missing slug never renders a
// 404 link.
export const FEATURED_CITIES: FeaturedCity[] = [
  { name: "Delhi", slug: "new-delhi" },
  { name: "Mumbai", slug: "mumbai" },
  { name: "Bengaluru", slug: "bengaluru-urban" },
  { name: "Hyderabad", slug: "hyderabad" },
  { name: "Pune", slug: "pune" },
  { name: "Chennai", slug: "chennai" },
  { name: "Kolkata", slug: "kolkata" },
  { name: "Ahmedabad", slug: "ahmadabad" },
  { name: "Jaipur", slug: "jaipur" },
  { name: "Lucknow", slug: "lucknow" },
  { name: "Patna", slug: "patna" },
  { name: "Ranchi", slug: "ranchi" },
  { name: "Varanasi", slug: "varanasi" },
  { name: "Prayagraj", slug: "prayagraj" },
];
