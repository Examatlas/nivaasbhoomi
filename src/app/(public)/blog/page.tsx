import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, Calendar, MapPin } from "lucide-react";

import { getPublishedPosts } from "@/lib/blog/query";
import { BRAND, absoluteUrl } from "@/lib/seo/site";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 3600; // ISR

export const metadata: Metadata = {
  title: `Property Guides & Market Insights | ${BRAND}`,
  description:
    "Guides on buying, renting and investing in property across India - localities, prices, paperwork and tips, explained simply.",
  alternates: { canonical: absoluteUrl("/blog") },
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Guides", url: "/blog" },
        ])}
      />

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">Guides</span>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display-md">Property guides & insights</h1>
          <p className="mt-2 text-muted-foreground">
            Clear, practical guides on buying, renting and investing across India.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-4 py-12 text-center text-muted-foreground">
            No guides published yet - check back soon.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <article
                key={p.slug}
                className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <Link href={`/blog/${p.slug}`} className="flex flex-1 flex-col outline-none">
                  <div className="relative aspect-[16/9] overflow-hidden bg-sand-200">
                    {p.coverImage?.startsWith("https://res.cloudinary.com/") ? (
                      <Image
                        src={p.coverImage}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                        priority={i < 3}
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sand-400">
                        {BRAND}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
                      {p.publishedAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3.5" /> {formatDate(p.publishedAt)}
                        </span>
                      )}
                      {p.cityName && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5 text-clay-500" /> {p.cityName}
                        </span>
                      )}
                    </div>
                    <h2 className="line-clamp-2 text-base font-semibold text-ink-950 group-hover:text-ink-700">
                      {p.title}
                    </h2>
                    {p.excerpt && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
