import type {
  ListingPhoto,
  ListingPurpose,
  PropertyType,
  Furnishing,
} from "@/types/listing";

/**
 * Public-safe property detail view-model.
 *
 * PRIVACY (DEV-SPEC.txt Section 13): this shape intentionally OMITS
 * listing.fullAddress and the dealer's phone/email. The mapper never copies
 * them across, so a public page physically cannot render them - contact happens
 * only through the WhatsApp CTA.
 */
export interface PublicDealer {
  slug: string | null;
  businessName: string;
  verificationTier: number;
  rating: number;
  ratingCount: number;
  avgResponseMinutes?: number;
  /** Zenith Code automation link. Drives the listing button mode (Contact Us vs
   *  WhatsApp). False for every dealer at launch. Not sensitive. */
  zenithConnected: boolean;
}

export interface PublicListingDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  purpose: ListingPurpose;
  propertyType: PropertyType;

  price: number; // expectedPrice (sale) or monthlyRent (rent)
  pricePerSqft?: number;
  priceNegotiable?: boolean;
  bookingAmount?: number;
  securityDeposit?: number;
  maintenanceCharge?: number;
  brokerage?: string; // shown openly
  preferredTenant?: string[];
  availableFrom?: string;
  minLeasePeriod?: string;

  bhk?: string;
  bathrooms?: number;
  balconies?: number;
  carpetArea?: number;
  builtUpArea?: number;
  plotArea?: number;
  floor?: number;
  totalFloors?: number;
  facing?: string;
  ageOfProperty?: string;

  furnishing?: Furnishing;
  furnishingDetails?: string[];
  amenities?: string[];
  parking?: string;
  waterSource?: string[];

  possessionStatus?: string;
  possessionDate?: string;
  ownershipType?: string;
  reraNumber?: string;
  reraStateName?: string;
  approvedBy?: string[];

  // location (NO fullAddress)
  localityName: string;
  localitySlug: string;
  cityName: string;
  citySlug: string;
  stateName?: string;
  subLocality?: string;
  projectName?: string;
  landmark?: string;
  lat?: number;
  lng?: number;

  photos: ListingPhoto[];
  coverPhotoIndex: number;
  video?: { url: string; publicId?: string; duration?: number };
  floorPlan?: { url: string; publicId?: string };

  badges: { documentsChecked: boolean; photosVerified: boolean; siteVisited: boolean };
  dealer: PublicDealer | null;

  refreshedAt: string;
  /** Portal WhatsApp number used for the enquiry CTA. */
  whatsappNumber: string;
}
