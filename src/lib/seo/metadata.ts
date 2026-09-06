import type { Metadata } from "next";

import {
  BRAND,
  absoluteUrl,
  truncateDescription,
  priceLabelForTitle,
} from "@/lib/seo/site";
import { bhkLabel, propertyTypePlural } from "@/lib/filters/describe";

/**
 * generateMetadata helpers per page type (DEV-SPEC.txt Section 10).
 *
 * Titles follow the exact Section 10 templates (target 55-60 chars);
 * descriptions target 150-160 chars and are trimmed to a word boundary.
 * canonical is ALWAYS an absolute, self-referencing URL, and openGraph carries
 * the cover image where one exists.
 */

interface BaseSeo {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/ranchi". Canonical is built from it. */
  path: string;
  image?: string; // absolute cover image URL
  noindex?: boolean;
}

/** Assemble a Next Metadata object with canonical + OpenGraph + Twitter. */
function build({ title, description, path, image, noindex }: BaseSeo): Metadata {
  const url = absoluteUrl(path);
  const images = image ? [{ url: image }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: BRAND,
      type: "website",
      locale: "en_IN",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ---- Static / legal pages (index + follow, self-canonical) ----

export function staticPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return build({ title: opts.title, description: opts.description, path: opts.path });
}

// ---- Home ----

export function homeMetadata(): Metadata {
  return build({
    title: `${BRAND} - Verified Property across India on WhatsApp`,
    description: truncateDescription(
      "Find verified flats, plots and houses across India and contact dealers " +
        "directly on WhatsApp. No spam calls, no hidden phone numbers.",
    ),
    path: "/",
  });
}

// ---- City ----

export interface CitySeo {
  cityName: string;
  citySlug: string;
  listingCount: number;
  topLocalities: string[];
}

export function cityMetadata(c: CitySeo): Metadata {
  const [l1, l2] = c.topLocalities;
  const areas = [l1, l2].filter(Boolean).join(", ");
  return build({
    // "{City} me Property - Flats, Plots aur Ghar | {Brand}"
    title: `${c.cityName} me Property - Flats, Plots aur Ghar | ${BRAND}`,
    // "{City} me {count}+ verified property listings. {l1}, {l2} aur aur bhi areas..."
    description: truncateDescription(
      `${c.cityName} me ${c.listingCount}+ verified property listings. ` +
        `${areas ? `${areas} aur ` : ""}aur bhi areas me flats, plots aur ghar.`,
    ),
    path: `/${c.citySlug}`,
  });
}

// ---- Locality ----

export interface LocalitySeo {
  localityName: string;
  cityName: string;
  citySlug: string;
  localitySlug: string;
  typeLabel: string; // e.g. "Property" or "Flats"
  listingCount: number;
  rateMin?: number;
  rateMax?: number;
  image?: string;
}

export function localityMetadata(l: LocalitySeo): Metadata {
  const rate =
    l.rateMin && l.rateMax
      ? ` Rate Rs ${priceLabelForTitle(l.rateMin)} se Rs ${priceLabelForTitle(l.rateMax)}.`
      : "";
  return build({
    // "{Locality}, {City} me {Type} - {count} Listings"
    title: `${l.localityName}, ${l.cityName} me ${l.typeLabel} - ${l.listingCount} Listings`,
    // "{Locality} {City} me {count} verified {type}. Rate ... Direct WhatsApp pe details."
    description: truncateDescription(
      `${l.localityName} ${l.cityName} me ${l.listingCount} verified ` +
        `${l.typeLabel.toLowerCase()}.${rate} Direct WhatsApp pe details.`,
    ),
    path: `/${l.citySlug}/${l.localitySlug}`,
    image: l.image,
  });
}

// ---- Filter page ----

export interface FilterSeo {
  filterLabel: string; // from describeFilter, e.g. "3 BHK Flats for Rent"
  localityName: string;
  cityName: string;
  citySlug: string;
  localitySlug: string;
  filterSegment: string;
  listingCount: number;
}

export function filterMetadata(f: FilterSeo): Metadata {
  return build({
    title: `${f.filterLabel} in ${f.localityName}, ${f.cityName} - ${f.listingCount} Listings`,
    description: truncateDescription(
      `${f.listingCount} verified ${f.filterLabel} in ${f.localityName}, ${f.cityName}. ` +
        `Photos, price aur direct WhatsApp contact.`,
    ),
    path: `/${f.citySlug}/${f.localitySlug}/${f.filterSegment}`,
  });
}

// ---- Property ----

export interface PropertySeo {
  slug: string;
  bhk?: string;
  propertyType: string;
  purpose: "sale" | "rent";
  localityName: string;
  cityName: string;
  price: number;
  description: string;
  image?: string;
}

export function propertyMetadata(p: PropertySeo): Metadata {
  const bhkPart = p.bhk ? `${bhkLabel(p.bhk).replace(" BHK", "")} BHK ` : "";
  const typePart = propertyTypePlural(p.propertyType).replace(/s$/, ""); // singular
  const purposePart = p.purpose === "rent" ? "for Rent" : "for Sale";
  return build({
    // "{bhk} BHK {type} for {purpose} in {locality}, {city} - Rs {price}"
    title:
      `${bhkPart}${typePart} ${purposePart} in ${p.localityName}, ${p.cityName} ` +
      `- Rs ${priceLabelForTitle(p.price)}`,
    // first 155 chars of the description
    description: truncateDescription(p.description, 155),
    path: `/property/${p.slug}`,
    image: p.image,
  });
}

// ---- Agent (public dealer profile) ----

export interface AgentSeo {
  slug: string;
  businessName: string;
  cityNames: string[];
  localityName?: string;
  dealTypes?: string[];
  listingCount: number;
  image?: string;
  noindex?: boolean;
}

const DEAL_TYPE_LABEL: Record<string, string> = {
  plot: "plots",
  flat: "flats",
  house: "houses",
  commercial: "commercial property",
  rent: "rentals",
  resale: "resale property",
};

export function agentMetadata(a: AgentSeo): Metadata {
  const place = a.localityName
    ? `${a.localityName}, ${a.cityNames[0] ?? ""}`.replace(/, $/, "")
    : a.cityNames.slice(0, 2).join(", ");
  const deals = (a.dealTypes ?? [])
    .map((d) => DEAL_TYPE_LABEL[d] ?? d)
    .slice(0, 3)
    .join(", ");
  return build({
    title: `${a.businessName} - Verified Property Dealer${place ? ` in ${place}` : ""} | ${BRAND}`,
    description: truncateDescription(
      `${a.businessName}: ${a.listingCount} verified listings${place ? ` in ${place}` : ""}` +
        `${deals ? ` — ${deals}` : ""}. Contact directly for site visits and details.`,
    ),
    path: `/agent/${a.slug}`,
    image: a.image,
    ...(a.noindex ? { noindex: true } : {}),
  });
}

// ---- Blog ----

export interface BlogSeo {
  slug: string;
  title: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  image?: string;
}

export function blogMetadata(b: BlogSeo): Metadata {
  return build({
    title: `${b.metaTitle ?? b.title} | ${BRAND}`,
    description: truncateDescription(b.metaDescription ?? b.excerpt ?? b.title),
    path: `/blog/${b.slug}`,
    image: b.image,
  });
}
