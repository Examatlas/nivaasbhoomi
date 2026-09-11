import type { UploadedImage } from "@/types/media";

export type ListingStatus =
  | "draft"
  | "pending"
  | "pending-location"
  | "approved"
  | "rejected"
  | "expired"
  | "deleted";

export const PROPERTY_TYPES = [
  { value: "flat", label: "Flat" },
  { value: "independent-house", label: "Independent House" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial-shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "pg", label: "PG" },
  { value: "warehouse", label: "Warehouse" },
  { value: "farmhouse", label: "Farm House" },
] as const;

export const BHK_OPTIONS = [
  { value: "1rk", label: "1 RK" },
  { value: "1", label: "1 BHK" },
  { value: "2", label: "2 BHK" },
  { value: "3", label: "3 BHK" },
  { value: "4", label: "4 BHK" },
  { value: "5plus", label: "5+ BHK" },
] as const;

export interface ListingRow {
  _id: string;
  title: string;
  slug: string | null;
  status: ListingStatus;
  purpose: "sale" | "rent";
  propertyType: string;
  bhk: string | null;
  price: number;
  cityName: string;
  dealerName: string;
  coverUrl: string | null;
  photoCount: number;
  /** Smallest photo's shorter side (px), or null when no photos/dimensions. */
  minResolution: number | null;
  /** true if any photo is low-resolution (dealer/admin signal, not shown to buyers). */
  hasLowRes: boolean;
  createdAt?: string;
  expiresAt?: string;
  isSeed?: boolean;
}

export interface DealerLite {
  _id: string;
  name: string;
  businessName: string;
  phone: string;
  verificationTier: number;
}

export interface ListingDetail {
  _id: string;
  title: string;
  slug: string | null;
  status: ListingStatus;
  purpose: "sale" | "rent";
  propertyType: string;
  isCntLand?: boolean;
  description?: string;
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
  furnishing?: string;
  furnishingDetails?: string[];
  amenities?: string[];
  parking?: string;
  waterSource?: string[];
  expectedPrice?: number;
  pricePerSqft?: number;
  priceNegotiable?: boolean;
  bookingAmount?: number;
  monthlyRent?: number;
  securityDeposit?: number;
  rentNegotiable?: boolean;
  preferredTenant?: string[];
  availableFrom?: string;
  minLeasePeriod?: string;
  maintenanceCharge?: number;
  brokerage?: string;
  possessionStatus?: string;
  possessionDate?: string;
  ownershipType?: string;
  reraNumber?: string;
  reraStateId?: string | null;
  subLocality?: string;
  projectName?: string;
  landmark?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
  pincode?: string;
  photos?: UploadedImage[];
  coverPhotoIndex?: number;
  badges?: {
    documentsChecked?: boolean;
    photosVerified?: boolean;
    siteVisited?: boolean;
  };
  rejectionReason?: string;
  lastRefreshedAt?: string;
  expiresAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  dealer: {
    _id: string;
    name: string;
    businessName: string;
    phone: string;
    verificationTier: number;
    rating: number;
    ratingCount: number;
    status: string;
  } | null;
  city: { _id: string; name: string; slug: string } | null;
  locality: { _id: string; name: string; slug: string } | null;
  state: { name: string } | null;
  cityId: string;
  localityId: string;
  stateId: string | null;
  dealerId: string;
}
