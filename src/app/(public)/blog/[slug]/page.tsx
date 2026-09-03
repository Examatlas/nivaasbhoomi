import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, Calendar, MapPin } from "lucide-react";

import { getPostBySlug, getPublishedSlugs } from "@/lib/blog/query";
import { blogMetadata } from "@/lib/seo/metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 3600; // ISR
export const dynamicParams = true; // new posts resolve without a rebuild

const load = cache((slug: string) => getPostBySlug(slug));

export async function generateStaticParams() {
  return getPublishedSlugs();
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) {
    return { title: "Guide not found", robots: { index: false, follow: false } };
  }
  return blogMetadata({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    image: post.coverImage,
  });
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) notFound();

  const cover = post.coverImage?.startsWith("https://res.cloudinary.com/")
    ? post.coverImage
    : undefined;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Guides", url: "/blog" },
            { name: post.title, url: `/blog/${post.slug}` },
          ]),
          articleJsonLd({
            slug: post.slug,
            title: post.title,
            description: post.metaDescription ?? post.excerpt,
            image: post.coverImage,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt ?? post.publishedAt,
          }),
        ]}
      />

      <article className="mx-auto max-w-prose px-4 py-6 sm:px-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/blog" className="hover:text-foreground">
            Guides
          </Link>
          <span aria-hidden>/</span>
          <span className="line-clamp-1 text-foreground">{post.title}</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-display-sm sm:text-display-md">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
            {post.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" /> {formatDate(post.publishedAt)}
              </span>
            )}
            {post.cityName && (
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <MapPin className="size-4 text-clay-500" /> {post.cityName}
              </Link>
            )}
          </div>
        </header>

        {cover && (
          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-card bg-sand-200">
            <Image
              src={cover}
              alt={post.title}
              fill
              sizes="(max-width: 704px) 100vw, 704px"
              priority
              className="object-cover"
            />
          </div>
        )}

        {/*
          Blog content is HTML authored only by the admin (Section 15), a trusted
          server-side source - the same trust boundary as our JSON-LD. It is
          rendered into a style-scoped container.
        */}
        <div
          className="nb-prose"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface-muted px-3 py-1 text-meta text-sand-700"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
