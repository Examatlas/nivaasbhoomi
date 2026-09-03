import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

/**
 * robots.txt (DEV-SPEC.txt Section 10).
 *
 * The public dealer profile lives at /agent/[slug] (a separate route group), so
 * /dealer/ - the private dealer panel - can be disallowed cleanly without
 * hiding the public profile. /admin and /api are also disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dealer/", "/admin/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
