/**
 * View-model types for public listing UI.
 *
 * These are intentionally a slim, presentation-facing projection of the full
 * Listing model (DEV-SPEC.txt Section 4) - a card never receives fullAddress,
 * dealer.phone, or any other field the privacy rules (Section 13) forbid
 * exposing. The API layer maps a Listing document to this shape; the UI only
 * ever sees what is safe to render.
 */

export type ListingPurpose = "sale" | "rent";

export type PropertyType =
  | "flat"
  | "independent-house"
  | "villa"
  | "plot"
  | "commercial-shop"
  | "office"
  | "pg"
  | "warehouse"
  | "farmhouse";

export type Furnishing = "furnished" | "semi-furnished" | "unfurnished";

export interface ListingPhoto {
  url: string;
  /** Cloudinary public id, when the photo is a Cloudinary asset. */
  publicId?: string;
  width: number;
  height: number;
  alt?: string;
}

/** Public trust badges from Listing.badges (Section 4). */
export interface ListingBadges {
  documentsChecked: boolean;
  photosVerified: boolean;
  siteVisited: boolean;
}

/** Everything a PropertyCard needs - and nothing it must not have. */
export interface ListingCardData {
  id: string;
  slug: string;
  title: string;
  purpose: ListingPurpose;
  propertyType: PropertyType;

  /** Dealer's CNT declaration (plots only). Renders a "CNT" tag when true. */
  isCntLand?: boolean;

  /** Sale -> expectedPrice, rent -> monthlyRent. Already chosen by the mapper. */
  price: number;

  bhk?: string;
  /** Chosen area (carpet preferred, else built-up, else super built-up, else plot). */
  area?: number;
  areaUnit?: string;
  furnishing?: Furnishing;

  /** Possession status ("ready-to-move" | "under-construction") — drives a card tag. */
  possessionStatus?: string;
  /** Project / society name, shown as a quiet line under the title. */
  projectName?: string;

  localityName: string;
  cityName: string;

  /** Cover photo shown on the card (defaults to photos[0]). */
  photo?: ListingPhoto;
  /** Full gallery for the property detail page. photoCount = photos.length. */
  photos?: ListingPhoto[];
  photoCount: number;

  badges: ListingBadges;
  /** Dealer verification tier 0-4, drives the verification badge. */
  verificationTier: number;

  /** lastRefreshedAt - freshness indicator source. */
  refreshedAt: string;

  /** Public WhatsApp number for the enquiry (portal or dealer number). */
  whatsappNumber: string;

  /** Zenith Code automation — SAFE fields only (never a token / orgId). When the
   *  dealer is connected the card shows a WhatsApp button to zenithNumber;
   *  otherwise "Contact Us". */
  zenithConnected?: boolean;
  zenithNumber?: string | null;

  featured?: boolean;

  /** Seed (display-only) listing. No contact CTA on the card or detail page. */
  isSeed?: boolean;
}
