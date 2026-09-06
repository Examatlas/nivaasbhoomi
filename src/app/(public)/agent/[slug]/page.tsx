import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Home, MapPin, Building2, Clock, Star } from "lucide-react";

import { getAgentProfile, getAgentStaticParams } from "@/lib/dealers/profile";
import { resolveDealerSlugRedirect } from "@/lib/dealers/slug-server";
import { agentMetadata } from "@/lib/seo/metadata";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";

import { JsonLd } from "@/components/shared/json-ld";
import { ListingGrid } from "@/components/public/listing-grid";
import { VerificationBadge } from "@/components/public/verification-badge";

export const revalidate = 3600; // ISR
// New dealers resolve on demand without a rebuild (Section 10).
export const dynamicParams = true;

const load = cache((slug: string) => getAgentProfile(slug));

export async function generateStaticParams() {
  return getAgentStaticParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/agent/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const agent = await load(slug);
  if (!agent) {
    return { title: "Dealer not found", robots: { index: false, follow: false } };
  }
  return agentMetadata({
    slug: agent.slug,
    businessName: agent.businessName,
    cityNames: agent.coverageCities.map((c) => c.name),
    listingCount: agent.listingCount,
    image: agent.profilePhoto,
  });
}

export default async function AgentProfilePage({
  params,
}: PageProps<"/agent/[slug]">) {
  const { slug } = await params;
  const agent = await load(slug);
  if (!agent) {
    // Not a current slug — 301 to the dealer's current slug if this is an old
    // one (protects indexed URLs, shared links, GBP entries); else 404.
    const to = await resolveDealerSlugRedirect(slug);
    if (to) permanentRedirect(`/agent/${to}`);
    notFound();
  }

  const hasRating = agent.ratingCount > 0;
  const cloudinaryPhoto =
    agent.profilePhoto?.startsWith("https://res.cloudinary.com/")
      ? agent.profilePhoto
      : undefined;
  const initials = agent.businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const jsonld = localBusinessJsonLd({
    slug: agent.slug,
    businessName: agent.businessName,
    cityNames: agent.coverageCities.map((c) => c.name),
    profilePhoto: agent.profilePhoto,
    rating: agent.rating,
    ratingCount: agent.ratingCount,
  });

  return (
    <>
      <JsonLd data={jsonld} />

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3.5" /> Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{agent.businessName}</span>
        </nav>

        {/* Profile header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-ink-50 ring-1 ring-border">
            {cloudinaryPhoto ? (
              <Image
                src={cloudinaryPhoto}
                alt={agent.businessName}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-semibold text-ink-500">
                {initials || <Building2 className="size-8" aria-hidden />}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display-sm">{agent.businessName}</h1>
              {agent.verificationTier >= 1 && (
                <VerificationBadge tier={agent.verificationTier} size="sm" />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-clay-500" aria-hidden />
                {agent.listingCount}{" "}
                {agent.listingCount === 1 ? "listing" : "listings"}
              </span>
              {hasRating && (
                <span className="inline-flex items-center gap-1.5 text-ink-800">
                  <Star className="size-4 fill-clay-400 text-clay-400" aria-hidden />
                  <span className="font-medium">{agent.rating.toFixed(1)}</span>
                  <span>({agent.ratingCount} reviews)</span>
                </span>
              )}
              {agent.avgResponseMinutes != null && (
                <span className="inline-flex items-center gap-1.5 text-success-700">
                  <Clock className="size-4" aria-hidden />
                  Usually responds in ~{agent.avgResponseMinutes} min
                </span>
              )}
            </div>

            {/* Coverage cities */}
            {agent.coverageCities.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-meta text-subtle-foreground">
                  <MapPin className="size-3.5" aria-hidden /> Serves:
                </span>
                {agent.coverageCities.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${c.slug}`}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-meta font-medium text-ink-800 transition-colors hover:bg-surface-muted"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Listings */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink-950">
            Listings by {agent.businessName}
          </h2>
          {agent.listings.length > 0 ? (
            <ListingGrid listings={agent.listings} />
          ) : (
            <p className="rounded-card border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
              This dealer has no live listings right now.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
