import { getSitemapIndexItems } from "@/lib/sitemap/query";
import { sitemapIndexXml, XML_HEADERS } from "@/lib/sitemap/xml";

/**
 * `/sitemap.xml` - the sitemap INDEX (DEV-SPEC.txt Section 10). References
 * /sitemap/static.xml, /sitemap/blogs.xml, and one /sitemap/<city>.xml per
 * isActive city (split into -2, -3 … past 50k URLs). This is a static route
 * segment, so it takes precedence over the dynamic [city] page and is never
 * mistaken for a city slug.
 */
export const revalidate = 3600; // ISR

export async function GET() {
  const items = await getSitemapIndexItems();
  return new Response(sitemapIndexXml(items), { headers: XML_HEADERS });
}
