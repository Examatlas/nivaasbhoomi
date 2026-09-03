import { getBlogSitemapEntries } from "@/lib/sitemap/query";
import { urlsetXml, XML_HEADERS } from "@/lib/sitemap/xml";

/** `/sitemap/blogs.xml` - published blog posts (Section 10). */
export const revalidate = 3600;

export async function GET() {
  const entries = await getBlogSitemapEntries();
  return new Response(urlsetXml(entries), { headers: XML_HEADERS });
}
