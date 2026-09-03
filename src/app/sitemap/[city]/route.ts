import { getSitemapCitySlugs, getCitySitemapPage } from "@/lib/sitemap/query";
import { urlsetXml, XML_HEADERS } from "@/lib/sitemap/xml";

/**
 * `/sitemap/<city>.xml` - the per-city sitemap (DEV-SPEC.txt Section 10).
 *
 * The `[city]` param arrives with the `.xml` extension (e.g. "ranchi.xml", or
 * "ranchi-2.xml" for a paginated split). We strip it, then resolve either
 * "<city>" (page 1) or "<city>-<n>" (page n) against the real active-city list -
 * so a city slug that itself ends in "-<digits>" is never mis-read as a page
 * suffix, and an inactive/unknown city 404s (never appears in a sitemap).
 */
export const revalidate = 3600; // ISR

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ city: string }> },
) {
  const { city } = await ctx.params;
  const id = city.replace(/\.xml$/i, "");

  const citySlugs = await getSitemapCitySlugs();

  let slug = id;
  let page = 1;
  if (!citySlugs.includes(id)) {
    const m = id.match(/^(.+)-(\d+)$/);
    if (m && m[1] && citySlugs.includes(m[1]) && Number(m[2]) >= 2) {
      slug = m[1];
      page = Number(m[2]);
    } else {
      return new Response("Not found", { status: 404 });
    }
  }

  const entries = await getCitySitemapPage(slug, page);
  return new Response(urlsetXml(entries), { headers: XML_HEADERS });
}
