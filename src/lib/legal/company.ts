/**
 * Canonical business facts for the legal / info pages, footer and contact form.
 * Single source of truth — nothing here is invented; edit in one place.
 */
export const COMPANY = {
  brand: "NivaasBhoomi",
  domain: "www.nivaasbhoomi.com",
  proprietor: "Sujit Kumar",
  entityType: "sole proprietorship",
  address: "Aryan Tower, East Jail Road, Lalpur, Ranchi, Jharkhand 834001, India",
  email: "support@nivaasbhoomi.com",
  /** Placeholder — the proprietor fills the real number in. */
  phone: "[PHONE]",
  hours: "Monday–Saturday, 10:00 AM – 7:00 PM IST",
  jurisdiction: "Ranchi, Jharkhand",
  lastUpdated: "6 September 2026",
} as const;
