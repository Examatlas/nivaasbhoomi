/** View-model types for the admin location manager (mirror the API responses). */

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StateRow {
  _id: string;
  name: string;
  slug: string;
  code: string;
  isActive: boolean;
  /** Live count of active cities in this state. */
  activeCityCount: number;
  /** Live count of all cities in this state. */
  cityCount: number;
}

export interface CityRow {
  _id: string;
  name: string;
  slug: string;
  tier: number;
  isActive: boolean;
  stateId: string;
  /** Approved listings, seed INCLUDED (the activation basis). Live count. */
  listingCount: number;
  /** Approved listings, seed EXCLUDED (real, contactable). Live count. */
  realListingCount: number;
  dealerCount: number;
  localityCount: number;
  /** Meets the activation guard now (live). Drives the row Activate button. */
  canActivate: boolean;
  /** Why it can't be activated yet, e.g. "Needs 1 listing (has 0)". */
  activationHint: string | null;
}

export interface LocalityRow {
  _id: string;
  name: string;
  slug: string;
  status: "approved" | "pending";
  isActive: boolean;
  cityId: string;
  cityName: string;
  /** Approved listings, seed INCLUDED. Live count. */
  listingCount: number;
  /** Approved listings, seed EXCLUDED (real). Live count. */
  realListingCount: number;
  pincodes: string[];
}

export interface LocalityRequestRow {
  _id: string;
  name: string;
  slug: string;
  pincodes: string[];
  requestedBy: string | null;
  createdAt?: string;
  city: { _id: string; name: string; slug: string } | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CityActivation {
  ok: boolean;
  counts: { approvedListings: number; verifiedDealers: number; activeLocalities: number };
  thresholds: {
    approvedListings: number;
    verifiedDealers: number;
    activeLocalities: number;
  };
  missing: string[];
}

export interface CityDetail {
  _id: string;
  name: string;
  slug: string;
  tier: number;
  isActive: boolean;
  state: { _id: string; name: string; slug: string } | null;
  introText: string;
  metaTitle: string;
  metaDescription: string;
  faq: FaqItem[];
  counters: { listingCount: number; dealerCount: number; localityCount: number };
  activation: CityActivation;
}

export interface LocalityActivation {
  isActive: boolean;
  reasons: string[];
  counts: { approvedListings: number; introTextChars: number };
}

export interface LocalityDetail {
  _id: string;
  name: string;
  slug: string;
  status: "approved" | "pending";
  isActive: boolean;
  city: { _id: string; name: string; slug: string } | null;
  pincodes: string[];
  introText: string;
  introTextChars: number;
  introTextRequired: number;
  connectivity: string;
  metaTitle: string;
  metaDescription: string;
  faq: FaqItem[];
  listingCount: number;
}
