import type { MetadataRoute } from "next";

/**
 * Minimal, dependency-free sitemap XML serializers (DEV-SPEC.txt Section 10).
 *
 * We hand-roll the XML (rather than use Next's metadata `sitemap.ts`) because
 * Section 10 requires `/sitemap.xml` to be a sitemap INDEX, and the metadata
 * convention only emits a flat <urlset>. Route handlers give us full control of
 * both the index and each per-city <urlset>.
 */

type SitemapEntry = MetadataRoute.Sitemap[number];

/** Escape the five XML predefined entities for text inside <loc> etc. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(d: Date | string | number | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A `<urlset>` document from sitemap entries. */
export function urlsetXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = toIso(e.lastModified);
      const parts = [`    <loc>${esc(e.url)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (e.changeFrequency)
        parts.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}${urls ? "\n" : ""}</urlset>\n`
  );
}

export interface IndexItem {
  loc: string;
  lastModified?: Date | string | null;
}

/** A `<sitemapindex>` document referencing child sitemaps. */
export function sitemapIndexXml(items: IndexItem[]): string {
  const body = items
    .map((it) => {
      const lastmod = toIso(it.lastModified);
      const parts = [`    <loc>${esc(it.loc)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}${body ? "\n" : ""}</sitemapindex>\n`
  );
}

/** Newest lastModified across entries, for a child sitemap's index <lastmod>. */
export function newestLastModified(entries: SitemapEntry[]): Date | undefined {
  let newest: number | undefined;
  for (const e of entries) {
    const iso = toIso(e.lastModified);
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (newest === undefined || t > newest) newest = t;
  }
  return newest === undefined ? undefined : new Date(newest);
}

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
} as const;
