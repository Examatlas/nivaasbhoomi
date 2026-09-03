import type { ListingCardData, ListingPhoto } from "@/types/listing";

/**
 * Sample listings for Phase 0 - used by the home page and the /design-system
 * review route so PropertyCard can be seen with realistic data before the
 * database and dealer panel exist.
 *
 * Photos are real, royalty-free property images bundled locally in
 * /public/samples (Unsplash licence). They are served from our own origin, so
 * they always load and never depend on an external CDN or Cloudinary demo asset.
 * Each listing carries a 4-5 image gallery; the card shows photos[0] as the
 * cover and the count badge. Replace with real Cloudinary uploads once the
 * dealer panel exists.
 */
const photo = (file: string, alt: string): ListingPhoto => ({
  url: `/samples/${file}.jpg`,
  width: 1200,
  height: 900,
  alt,
});

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919000000000";

/** Build a listing, deriving cover + photoCount from the gallery. */
function listing(
  data: Omit<ListingCardData, "photo" | "photoCount"> & { photos: ListingPhoto[] },
): ListingCardData {
  return { ...data, photo: data.photos[0], photoCount: data.photos.length };
}

export const SAMPLE_LISTINGS: ListingCardData[] = [
  listing({
    id: "1",
    slug: "3-bhk-flat-kanke-road-ranchi-52-lakh-a7x9k2",
    title: "Spacious 3 BHK in a gated society near Kanke Road",
    purpose: "sale",
    propertyType: "flat",
    price: 5_200_000,
    bhk: "3",
    area: 1250,
    areaUnit: "sq.ft.",
    furnishing: "semi-furnished",
    localityName: "Kanke Road",
    cityName: "Ranchi",
    photos: [
      photo("apt-building", "Apartment building exterior with balconies"),
      photo("living-room2", "Furnished living room"),
      photo("kitchen", "Modular kitchen"),
      photo("bedroom", "Bedroom"),
      photo("balcony", "Sit-out with plants"),
    ],
    badges: { documentsChecked: true, photosVerified: true, siteVisited: true },
    verificationTier: 4,
    refreshedAt: daysAgo(1),
    whatsappNumber: WHATSAPP,
    featured: true,
  }),
  listing({
    id: "2",
    slug: "2-bhk-flat-lalpur-ranchi-25k-rent-b3m8p1",
    title: "Bright 2 BHK, walk to Lalpur Chowk, family preferred",
    purpose: "rent",
    propertyType: "flat",
    price: 25_000,
    bhk: "2",
    area: 980,
    areaUnit: "sq.ft.",
    furnishing: "furnished",
    localityName: "Lalpur",
    cityName: "Ranchi",
    photos: [
      photo("apt-exterior", "Apartment block exterior"),
      photo("living-room", "Living room with feature chair"),
      photo("dining", "Living and dining area"),
      photo("kitchen", "Kitchen"),
      photo("bedroom", "Bedroom"),
    ],
    badges: { documentsChecked: true, photosVerified: true, siteVisited: false },
    verificationTier: 2,
    refreshedAt: daysAgo(4),
    whatsappNumber: WHATSAPP,
  }),
  listing({
    id: "3",
    slug: "residential-plot-hinoo-ranchi-38-lakh-c9k2x7",
    title: "North-facing residential plot in a developing pocket of Hinoo",
    purpose: "sale",
    propertyType: "plot",
    price: 3_800_000,
    area: 2400,
    areaUnit: "sq.ft.",
    localityName: "Hinoo",
    cityName: "Ranchi",
    photos: [
      photo("plot-land", "Open residential land"),
      photo("land-plot", "Newly built homes in the developing pocket"),
      photo("house-exterior", "Nearby independent house"),
    ],
    badges: { documentsChecked: true, photosVerified: false, siteVisited: false },
    verificationTier: 3,
    refreshedAt: daysAgo(12),
    whatsappNumber: WHATSAPP,
  }),
  listing({
    id: "4",
    slug: "4-bhk-villa-ashok-nagar-ranchi-1-25-crore-d5n3q9",
    title: "4 BHK independent villa with garden in Ashok Nagar",
    purpose: "sale",
    propertyType: "villa",
    price: 12_500_000,
    bhk: "4",
    area: 3200,
    areaUnit: "sq.ft.",
    furnishing: "unfurnished",
    localityName: "Ashok Nagar",
    cityName: "Ranchi",
    photos: [
      photo("villa", "Villa with pool"),
      photo("villa2", "Villa exterior and terrace"),
      photo("house-exterior", "Garden frontage at dusk"),
      photo("living-room2", "Living room"),
      photo("kitchen", "Kitchen"),
    ],
    badges: { documentsChecked: true, photosVerified: true, siteVisited: true },
    verificationTier: 4,
    refreshedAt: daysAgo(23),
    whatsappNumber: WHATSAPP,
  }),
];
