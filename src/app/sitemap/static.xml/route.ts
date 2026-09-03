import { getStaticSitemapEntries } from "@/lib/sitemap/query";
import { urlsetXml, XML_HEADERS } from "@/lib/sitemap/xml";

/** `/sitemap/static.xml` - evergreen, non-entity pages (Section 10). */
export const revalidate = 3600;

export async function GET() {
  return new Response(urlsetXml(getStaticSitemapEntries()), { headers: XML_HEADERS });
}
