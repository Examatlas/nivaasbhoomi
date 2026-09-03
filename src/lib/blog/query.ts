
import { connectDB } from "@/lib/db/connect";
import { Blog } from "@/lib/db/models/Blog";
import { City } from "@/lib/db/models/City";

/**
 * Blog data layer (DEV-SPEC.txt Sections 4, 9, 10). Only PUBLISHED posts are
 * ever exposed publicly; drafts never resolve.
 */

export interface BlogCard {
  slug: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  cityName?: string;
  tags: string[];
  publishedAt?: string;
}

export interface BlogPost extends BlogCard {
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  updatedAt?: string;
}

/** Published posts, newest first, as cards for the index. */
export async function getPublishedPosts(limit = 50): Promise<BlogCard[]> {
  await connectDB();
  const rows = await Blog.find(
    { status: "published", slug: { $type: "string" } },
    { slug: 1, title: 1, excerpt: 1, coverImage: 1, cityId: 1, tags: 1, publishedAt: 1 },
  )
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  const cityIds = [...new Set(rows.map((r) => r.cityId).filter(Boolean).map(String))];
  const cityName =
    cityIds.length > 0
      ? new Map(
          (await City.find({ _id: { $in: cityIds } }, { name: 1 }).lean()).map((c) => [
            String(c._id),
            c.name,
          ]),
        )
      : new Map<string, string>();

  return rows.map((r) => ({
    slug: r.slug!,
    title: r.title,
    excerpt: r.excerpt ?? undefined,
    coverImage: r.coverImage ?? undefined,
    cityName: r.cityId ? cityName.get(String(r.cityId)) : undefined,
    tags: r.tags ?? [],
    publishedAt: r.publishedAt?.toISOString(),
  }));
}

/** One published post by slug, or null (draft/missing -> 404). */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  await connectDB();
  const post = await Blog.findOne({ slug, status: "published" }).lean();
  if (!post) return null;

  let cityName: string | undefined;
  if (post.cityId) {
    const city = await City.findById(post.cityId, { name: 1 }).lean();
    cityName = city?.name;
  }

  return {
    slug: post.slug!,
    title: post.title,
    excerpt: post.excerpt ?? undefined,
    coverImage: post.coverImage ?? undefined,
    cityName,
    tags: post.tags ?? [],
    content: post.content ?? "",
    metaTitle: post.metaTitle ?? undefined,
    metaDescription: post.metaDescription ?? undefined,
    publishedAt: post.publishedAt?.toISOString(),
    updatedAt: (post as { updatedAt?: Date }).updatedAt?.toISOString(),
  };
}

/** Published slugs for generateStaticParams. */
export async function getPublishedSlugs(): Promise<{ slug: string }[]> {
  await connectDB();
  const rows = await Blog.find(
    { status: "published", slug: { $type: "string" } },
    { slug: 1 },
  ).lean();
  return rows.map((r) => ({ slug: r.slug! }));
}

