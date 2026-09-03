import type { ListingCardData } from "@/types/listing";

/**
 * Sample listings for Phase 0 - used by the home page and the /design-system
 * review route so PropertyCard can be seen with realistic data before the
 * database and dealer panel exist. Images are Cloudinary demo assets (allowed
 * by next.config remotePatterns). Delete this file once real listings land.
 */
const IMG = (id: string) =>
  `https://res.cloudinary.com/demo/image/upload/w_1200,h_900,c_fill,g_auto,f_auto,q_auto/${id}`;

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919000000000";

export const SAMPLE_LISTINGS: ListingCardData[] = [
  {
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
    photo: { url: IMG("house.jpg"), width: 1200, height: 900 },
    photoCount: 12,
    badges: { documentsChecked: true, photosVerified: true, siteVisited: true },
    verificationTier: 4,
    refreshedAt: daysAgo(1),
    whatsappNumber: WHATSAPP,
    featured: true,
  },
  {
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
    photo: { url: IMG("living-room.jpg"), width: 1200, height: 900 },
    photoCount: 8,
    badges: { documentsChecked: true, photosVerified: true, siteVisited: false },
    verificationTier: 2,
    refreshedAt: daysAgo(4),
    whatsappNumber: WHATSAPP,
  },
  {
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
    photo: { url: IMG("landscapes/beach-boat.jpg"), width: 1200, height: 900 },
    photoCount: 5,
    badges: { documentsChecked: true, photosVerified: false, siteVisited: false },
    verificationTier: 3,
    refreshedAt: daysAgo(12),
    whatsappNumber: WHATSAPP,
  },
  {
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
    photo: { url: IMG("sample.jpg"), width: 1200, height: 900 },
    photoCount: 18,
    badges: { documentsChecked: true, photosVerified: true, siteVisited: true },
    verificationTier: 4,
    refreshedAt: daysAgo(23),
    whatsappNumber: WHATSAPP,
  },
];
