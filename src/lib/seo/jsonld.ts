import { BRAND, SITE_URL, absoluteUrl, WHATSAPP_NUMBER } from "@/lib/seo/site";

/**
 * JSON-LD builders (DEV-SPEC.txt Section 10). Each returns a plain object ready
 * to inject via <JsonLd>. Values are already public-safe - callers pass only
 * fields allowed by the privacy rules (Section 13).
 *
 * schema.org note: every object carries @context + @type and the required
 * fields for its type; optional fields are omitted when absent rather than
 * emitted as null (cleaner, and avoids Rich Results warnings).
 */

// A JSON-LD node is an arbitrary JSON object; keep it loose but serialisable.
export type JsonLdObject = Record<string, unknown>;

const INR = "INR";

// ---- site-wide ----

/** Organization (home). */
export function organizationJsonLd(): JsonLdObject {
  const sameAs = WHATSAPP_NUMBER ? [`https://wa.me/${WHATSAPP_NUMBER}`] : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: SITE_URL,
    logo: absoluteUrl("/icon.png"),
    ...(sameAs ? { sameAs } : {}),
    ...(WHATSAPP_NUMBER
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: `+${WHATSAPP_NUMBER}`,
            availableLanguage: ["Hindi", "English"],
          },
        }
      : {}),
  };
}

/** WebSite + SearchAction (home). */
export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ---- breadcrumbs ----

export interface Crumb {
  name: string;
  /** Absolute or site-relative path. */
  url: string;
}

/** BreadcrumbList. Pass ordered crumbs Home > City > Locality > … */
export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url.startsWith("http") ? c.url : absoluteUrl(c.url),
    })),
  };
}

// ---- FAQ ----

export interface FaqEntry {
  question: string;
  answer: string;
}

/** FAQPage (city / locality). Returns null when there are no FAQs. */
export function faqPageJsonLd(faqs: FaqEntry[]): JsonLdObject | null {
  const valid = faqs.filter((f) => f.question?.trim() && f.answer?.trim());
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: valid.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// ---- HowTo ----

export interface HowToStep {
  name: string;
  text: string;
}

/** HowTo (step-by-step guides like mutation/dakhil-kharij). Returns null when
 *  there are no steps. */
export function howToJsonLd(
  name: string,
  steps: HowToStep[],
  description?: string,
): JsonLdObject | null {
  const valid = steps.filter((s) => s.name?.trim() && s.text?.trim());
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    ...(description ? { description } : {}),
    step: valid.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

// ---- ItemList ----

export interface ListItem {
  url: string;
  name?: string;
}

/** ItemList (locality listings). */
export function itemListJsonLd(items: ListItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: it.url.startsWith("http") ? it.url : absoluteUrl(it.url),
      ...(it.name ? { name: it.name } : {}),
    })),
  };
}

// ---- property page ----

export interface PropertyJsonLdInput {
  slug: string;
  title: string;
  description: string;
  purpose: "sale" | "rent";
  price: number; // expectedPrice for sale, monthlyRent for rent
  images: string[]; // absolute Cloudinary URLs
  localityName: string;
  cityName: string;
  areaSqft?: number;
  bhk?: string;
  availability?: "InStock" | "PreOrder";
}

/** RealEstateListing (property). */
export function realEstateListingJsonLd(p: PropertyJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/property/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.title,
    description: p.description,
    url,
    ...(p.images.length ? { image: p.images } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: p.localityName,
      addressRegion: p.cityName,
      addressCountry: "IN",
    },
    ...(p.areaSqft
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: p.areaSqft,
            unitCode: "FTK", // square foot
          },
        }
      : {}),
  };
}

/** Product + Offer (property price / availability). */
export function productOfferJsonLd(p: PropertyJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/property/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description,
    ...(p.images.length ? { image: p.images } : {}),
    category: p.purpose === "rent" ? "Property for Rent" : "Property for Sale",
    offers: {
      "@type": "Offer",
      url,
      price: p.price,
      priceCurrency: INR,
      availability: `https://schema.org/${p.availability ?? "InStock"}`,
      ...(p.purpose === "rent"
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: p.price,
              priceCurrency: INR,
              unitCode: "MON", // per month
            },
          }
        : {}),
    },
  };
}

// ---- dealer / agent profile ----

export interface AgentJsonLdInput {
  slug: string;
  businessName: string;
  cityNames: string[];
  localityNames?: string[];
  image?: string;
  officeAddress?: string;
  mapLat?: number;
  mapLng?: number;
  /** Public phone — only pass when the dealer opted in. */
  telephone?: string;
  rating?: number;
  ratingCount?: number;
}

/** RealEstateAgent (agent profile), with aggregateRating when there are reviews. */
export function localBusinessJsonLd(a: AgentJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/agent/${a.slug}`);
  const areaServed = [
    ...a.cityNames.map((name) => ({ "@type": "City", name })),
    ...(a.localityNames ?? []).map((name) => ({ "@type": "Place", name })),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: a.businessName,
    url,
    ...(a.image ? { image: a.image } : {}),
    ...(a.telephone ? { telephone: a.telephone } : {}),
    ...(a.officeAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: a.officeAddress,
            ...(a.cityNames[0] ? { addressLocality: a.cityNames[0] } : {}),
            addressCountry: "IN",
          },
        }
      : {}),
    ...(typeof a.mapLat === "number" && typeof a.mapLng === "number"
      ? { geo: { "@type": "GeoCoordinates", latitude: a.mapLat, longitude: a.mapLng } }
      : {}),
    ...(areaServed.length ? { areaServed } : {}),
    ...(a.ratingCount && a.ratingCount > 0 && a.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: a.rating,
            reviewCount: a.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

// ---- blog ----

export interface ArticleJsonLdInput {
  slug: string;
  title: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}

/**
 * BlogPosting (blog article). headline is required by Google's Article rich
 * result; datePublished/image/author/publisher are recommended and included
 * when available. Author + publisher are the portal Organization.
 */
export function articleJsonLd(a: ArticleJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/blog/${a.slug}`);
  const org = { "@type": "Organization", name: BRAND, url: SITE_URL };
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(a.description ? { description: a.description } : {}),
    ...(a.image ? { image: a.image } : {}),
    ...(a.datePublished ? { datePublished: a.datePublished } : {}),
    ...(a.dateModified ? { dateModified: a.dateModified } : {}),
    author: org,
    // publisher.logo is omitted deliberately: no brand logo asset exists yet,
    // and a broken logo URL fails Rich Results validation worse than none.
    publisher: org,
  };
}
