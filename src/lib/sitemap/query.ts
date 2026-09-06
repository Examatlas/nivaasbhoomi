import { cache } from "react";
import mongoose from "mongoose";
import type { MetadataRoute } from "next";

import { connectDB } from "@/lib/db/connect";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { Listing } from "@/lib/db/models/Listing";
import { Dealer } from "@/lib/db/models/Dealer";
import { Blog } from "@/lib/db/models/Blog";
import type { FilterQuery } from "@/lib/filters/parse";
import { filterToSegment } from "@/lib/filters/segment";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Sitemap data layer (DEV-SPEC.txt Section 10).
 *
 * Hard rules encoded here:
 *  - ONLY isActive cities appear anywhere. Every per-city query starts from an
 *    active city; inactive cities never resolve.
 *  - Filter URLs are emitted ONLY for combinations with >= THIN_PAGE_MIN (3)
 *    approved listings - below that the filter page 404s by design, so it must
 *    never appear in a sitemap.
 *  - lastModified is the real updatedAt of the underlying entity.
 *  - changeFrequency: listings 'daily', localities/cities/filters/dealers
 *    'weekly' (Section 10 fixes listing/locality/city; filters and dealer
 *    profiles are derivative long-tail pages, so they follow the 'weekly'
 *    cadence of the locality/city they hang off).
 */

/** Google's hard cap: 50,000 URLs per sitemap file. */
export const SITEMAP_URL_LIMIT = 50_000;

/** Minimum approved listings for a filter page to be indexable (mirrors S10). */
const THIN_PAGE_MIN = 3;

type SitemapEntry = MetadataRoute.Sitemap[number];

// ---- cities ----

/** Active city slugs (drives the index + generateSitemaps ids). */
export const getSitemapCitySlugs = cache(async (): Promise<string[]> => {
  await connectDB();
  const rows = await City.find({ isActive: true }, { slug: 1 })
    .sort({ slug: 1 })
    .lean();
  return rows.map((c) => c.slug);
});

// ---- per-city sitemap ----

/** Ordered list of the (non-budget) filter groupings we enumerate, mirroring the
 *  shapes the filter parser + generateStaticParams accept. */
const FILTER_GROUPINGS: {
  key: Record<string, string>;
  toFilter: (r: Record<string, string>) => FilterQuery | null;
}[] = [
  {
    key: { localityId: "$localityId", propertyType: "$propertyType" },
    toFilter: (r) => ({ propertyType: r.propertyType! }),
  },
  {
    key: { localityId: "$localityId", bhk: "$bhk", propertyType: "$propertyType" },
    toFilter: (r) => (r.bhk ? { propertyType: r.propertyType!, bhk: r.bhk } : null),
  },
  {
    key: {
      localityId: "$localityId",
      propertyType: "$propertyType",
      purpose: "$purpose",
    },
    toFilter: (r) => ({
      propertyType: r.propertyType!,
      purpose: r.purpose as "sale" | "rent",
    }),
  },
  {
    key: {
      localityId: "$localityId",
      bhk: "$bhk",
      propertyType: "$propertyType",
      purpose: "$purpose",
    },
    toFilter: (r) =>
      r.bhk
        ? {
            propertyType: r.propertyType!,
            bhk: r.bhk,
            purpose: r.purpose as "sale" | "rent",
          }
        : null,
  },
  {
    key: {
      localityId: "$localityId",
      furnishing: "$furnishing",
      propertyType: "$propertyType",
      purpose: "$purpose",
    },
    toFilter: (r) =>
      r.furnishing
        ? {
            propertyType: r.propertyType!,
            furnishing: r.furnishing as FilterQuery["furnishing"],
            purpose: r.purpose as "sale" | "rent",
          }
        : null,
  },
];

/**
 * Every sitemap URL for one active city, in a STABLE order (city -> localities
 * -> filters -> listings -> dealers). The order is deterministic so that
 * pagination (-2, -3 …) slices consistently across requests. Returns [] if the
 * city is missing or inactive.
 */
export const getCitySitemapEntries = cache(
  async (citySlug: string): Promise<SitemapEntry[]> => {
    await connectDB();

    const city = await City.findOne(
      { slug: citySlug, isActive: true },
      { slug: 1, updatedAt: 1 },
    ).lean();
    if (!city) return [];

    const cityId = city._id as mongoose.Types.ObjectId;
    const entries: SitemapEntry[] = [];

    // 1) City page.
    entries.push({
      url: absoluteUrl(`/${city.slug}`),
      lastModified: city.updatedAt ?? new Date(),
      changeFrequency: "weekly",
    });

    // 2) Active localities in this city (scoped by cityId - locality slugs are
    //    only unique within a city).
    const localities = await Locality.find(
      { cityId, isActive: true },
      { slug: 1, updatedAt: 1 },
    )
      .sort({ slug: 1 })
      .lean();
    const localitySlugById = new Map<string, string>();
    const localityUpdatedById = new Map<string, Date>();
    for (const l of localities) {
      localitySlugById.set(String(l._id), l.slug);
      localityUpdatedById.set(String(l._id), l.updatedAt ?? new Date());
      entries.push({
        url: absoluteUrl(`/${city.slug}/${l.slug}`),
        lastModified: l.updatedAt ?? new Date(),
        changeFrequency: "weekly",
      });
    }

    // 3) Valid filter combinations with >= 3 approved listings, scoped to this
    //    city's localities. Below the threshold the page 404s, so it is omitted.
    if (localities.length > 0) {
      const localityIds = localities.map((l) => l._id);
      const match = { status: "approved", localityId: { $in: localityIds } };
      const seen = new Set<string>();
      const filterEntries: SitemapEntry[] = [];

      for (const g of FILTER_GROUPINGS) {
        const rows = await Listing.aggregate<{
          _id: Record<string, unknown>;
          n: number;
        }>([
          { $match: match },
          { $group: { _id: g.key, n: { $sum: 1 } } },
          { $match: { n: { $gte: THIN_PAGE_MIN } } },
        ]);
        for (const row of rows) {
          const raw = row._id;
          const localitySlug = localitySlugById.get(String(raw.localityId));
          if (!localitySlug) continue;
          const fq = g.toFilter({
            propertyType: String(raw.propertyType ?? ""),
            bhk: raw.bhk ? String(raw.bhk) : "",
            purpose: raw.purpose ? String(raw.purpose) : "",
            furnishing: raw.furnishing ? String(raw.furnishing) : "",
          });
          if (!fq) continue;
          const segment = filterToSegment(fq);
          if (!segment) continue;
          const key = `${localitySlug}/${segment}`;
          if (seen.has(key)) continue;
          seen.add(key);
          filterEntries.push({
            url: absoluteUrl(`/${city.slug}/${localitySlug}/${segment}`),
            // A filter is a slice of one locality; use that locality's freshness.
            lastModified: localityUpdatedById.get(String(raw.localityId)) ?? new Date(),
            changeFrequency: "weekly",
          });
        }
      }
      filterEntries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
      entries.push(...filterEntries);
    }

    // 4) All approved listings in this city.
    const listings = await Listing.find(
      { cityId, status: "approved", slug: { $type: "string" } },
      { slug: 1, updatedAt: 1, lastRefreshedAt: 1 },
    )
      .sort({ slug: 1 })
      .lean();
    for (const l of listings) {
      entries.push({
        url: absoluteUrl(`/property/${l.slug}`),
        lastModified: l.updatedAt ?? l.lastRefreshedAt ?? new Date(),
        changeFrequency: "daily",
      });
    }

    // 5) Dealers with coverage in this city (public /agent profiles). Only
    //    INDEX-WORTHY profiles are listed (S10): verified (Tier 1+), an about
    //    field, AND 3+ active listings. Thin profiles stay noindex and out of the
    //    sitemap so they don't drag down domain quality.
    const dealers = await Dealer.find(
      {
        coverageCities: cityId,
        slug: { $type: "string" },
        status: { $ne: "banned" },
        verificationTier: { $gte: 1 },
        about: { $type: "string", $ne: "" },
      },
      { slug: 1, updatedAt: 1 },
    )
      .sort({ slug: 1 })
      .lean();

    const dealerIds = dealers.map((d) => d._id);
    const listingCounts = dealerIds.length
      ? await Listing.aggregate<{ _id: unknown; n: number }>([
          { $match: { dealerId: { $in: dealerIds }, status: "approved" } },
          { $group: { _id: "$dealerId", n: { $sum: 1 } } },
        ])
      : [];
    const countByDealer = new Map(listingCounts.map((c) => [String(c._id), c.n]));

    for (const d of dealers) {
      if ((countByDealer.get(String(d._id)) ?? 0) < 3) continue; // gate: 3+ listings
      entries.push({
        url: absoluteUrl(`/agent/${d.slug}`),
        lastModified: d.updatedAt ?? new Date(),
        changeFrequency: "weekly",
      });
    }

    return entries;
  },
);

/** How many sitemap pages a city needs (1 unless it exceeds 50k URLs). */
export async function getCitySitemapPageCount(citySlug: string): Promise<number> {
  const entries = await getCitySitemapEntries(citySlug);
  return Math.max(1, Math.ceil(entries.length / SITEMAP_URL_LIMIT));
}

/** One page (1-indexed) of a city's sitemap, capped at 50k URLs. */
export async function getCitySitemapPage(
  citySlug: string,
  page = 1,
): Promise<SitemapEntry[]> {
  const entries = await getCitySitemapEntries(citySlug);
  const start = (page - 1) * SITEMAP_URL_LIMIT;
  return entries.slice(start, start + SITEMAP_URL_LIMIT);
}

// ---- blogs ----

/** The /blog index + every published post. */
export async function getBlogSitemapEntries(): Promise<SitemapEntry[]> {
  await connectDB();
  const posts = await Blog.find(
    { status: "published", slug: { $type: "string" } },
    { slug: 1, updatedAt: 1, publishedAt: 1 },
  )
    .sort({ slug: 1 })
    .lean();

  const entries: SitemapEntry[] = [
    {
      url: absoluteUrl("/blog"),
      lastModified: posts[0]?.updatedAt ?? new Date(),
      changeFrequency: "weekly",
    },
  ];
  for (const p of posts) {
    entries.push({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
      changeFrequency: "monthly",
    });
  }
  return entries;
}

// ---- index ----

export interface SitemapIndexItem {
  loc: string;
  lastModified?: Date;
}

/** Every child sitemap the index references: static, blogs, and one per active
 *  city (paginated into -2, -3 … past 50k URLs). ONLY active cities appear. */
export async function getSitemapIndexItems(): Promise<SitemapIndexItem[]> {
  const items: SitemapIndexItem[] = [];

  items.push({ loc: absoluteUrl("/sitemap/static.xml"), lastModified: new Date() });

  const blogEntries = await getBlogSitemapEntries();
  items.push({
    loc: absoluteUrl("/sitemap/blogs.xml"),
    lastModified: newestDate(blogEntries),
  });

  const citySlugs = await getSitemapCitySlugs();
  for (const slug of citySlugs) {
    const entries = await getCitySitemapEntries(slug);
    const pages = Math.max(1, Math.ceil(entries.length / SITEMAP_URL_LIMIT));
    for (let p = 1; p <= pages; p++) {
      const slice = entries.slice((p - 1) * SITEMAP_URL_LIMIT, p * SITEMAP_URL_LIMIT);
      items.push({
        loc: absoluteUrl(`/sitemap/${slug}${p > 1 ? `-${p}` : ""}.xml`),
        lastModified: newestDate(slice),
      });
    }
  }
  return items;
}

function newestDate(entries: SitemapEntry[]): Date | undefined {
  let newest: number | undefined;
  for (const e of entries) {
    const d = e.lastModified;
    if (!d) continue;
    const t = (d instanceof Date ? d : new Date(d)).getTime();
    if (!Number.isNaN(t) && (newest === undefined || t > newest)) newest = t;
  }
  return newest === undefined ? undefined : new Date(newest);
}

// ---- static ----

/** Evergreen, non-entity pages. Kept tiny + explicit so we never emit a route
 *  that doesn't exist. */
export function getStaticSitemapEntries(): SitemapEntry[] {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily" },
    { url: absoluteUrl("/tools"), lastModified: now, changeFrequency: "monthly" },
    { url: absoluteUrl("/tools/emi-calculator"), lastModified: now, changeFrequency: "monthly" },
    { url: absoluteUrl("/tools/stamp-duty-calculator"), lastModified: now, changeFrequency: "monthly" },
    { url: absoluteUrl("/about-us"), lastModified: now, changeFrequency: "monthly" },
    { url: absoluteUrl("/contact-us"), lastModified: now, changeFrequency: "monthly" },
    { url: absoluteUrl("/privacy-policy"), lastModified: now, changeFrequency: "yearly" },
    { url: absoluteUrl("/terms-and-conditions"), lastModified: now, changeFrequency: "yearly" },
    { url: absoluteUrl("/refund-policy"), lastModified: now, changeFrequency: "yearly" },
    { url: absoluteUrl("/disclaimer"), lastModified: now, changeFrequency: "yearly" },
  ];
}
