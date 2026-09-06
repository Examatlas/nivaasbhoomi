import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  Home,
  MapPin,
  Building2,
  Clock,
  Star,
  Phone,
  Mail,
  Tag,
  IndianRupee,
  Users,
  Languages,
  CalendarDays,
} from "lucide-react";

import { getAgentProfile, getAgentStaticParams, agentQualifiesForIndex } from "@/lib/dealers/profile";
import { resolveDealerSlugRedirect } from "@/lib/dealers/slug-server";
import { resolveContactMode } from "@/lib/leads/contact-mode";
import { agentMetadata } from "@/lib/seo/metadata";
import { localBusinessJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

import { JsonLd } from "@/components/shared/json-ld";
import { ListingGrid } from "@/components/public/listing-grid";
import { VerificationBadge } from "@/components/public/verification-badge";
import { PropertyContactButton } from "@/components/public/property-contact-button";

const DEAL_LABEL: Record<string, string> = {
  plot: "Plots",
  flat: "Flats",
  house: "Houses",
  commercial: "Commercial",
  rent: "Rentals",
  resale: "Resale",
};

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
    localityName: agent.serviceLocalities[0]?.name,
    dealTypes: agent.dealTypes,
    listingCount: agent.listingCount,
    image: agent.bannerImage ?? agent.logoImage ?? agent.profilePhoto,
    // Thin profiles stay noindex — only verified, 3+ listings, about filled.
    noindex: !agentQualifiesForIndex(agent),
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
  const logoSrc = agent.logoImage ?? agent.profilePhoto;
  const cloudinaryPhoto = logoSrc?.startsWith("https://res.cloudinary.com/") ? logoSrc : undefined;
  const initials = agent.businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const jsonld = [
    localBusinessJsonLd({
      slug: agent.slug,
      businessName: agent.businessName,
      cityNames: agent.coverageCities.map((c) => c.name),
      localityNames: agent.serviceLocalities.map((l) => l.name),
      image: agent.bannerImage ?? agent.logoImage ?? agent.profilePhoto,
      officeAddress: agent.officeAddress,
      mapLat: agent.mapLat,
      mapLng: agent.mapLng,
      telephone: agent.publicPhone ? `+${agent.publicPhone}` : undefined,
      rating: agent.rating,
      ratingCount: agent.ratingCount,
    }),
    breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: agent.businessName, url: `/agent/${agent.slug}` },
    ]),
  ];

  const contactMode = resolveContactMode({ zenithConnected: agent.zenithConnected });

  const fmtPrice = (n: number) =>
    n >= 1e7
      ? `₹${Number((n / 1e7).toFixed(2))} Cr`
      : n >= 1e5
        ? `₹${Number((n / 1e5).toFixed(2))} L`
        : `₹${n.toLocaleString("en-IN")}`;
  const priceRange =
    agent.priceRangeMin && agent.priceRangeMax
      ? `${fmtPrice(agent.priceRangeMin)} – ${fmtPrice(agent.priceRangeMax)}`
      : agent.priceRangeMin
        ? `From ${fmtPrice(agent.priceRangeMin)}`
        : agent.priceRangeMax
          ? `Up to ${fmtPrice(agent.priceRangeMax)}`
          : null;
  const hasDetails =
    agent.establishedYear != null ||
    agent.yearsExperience != null ||
    agent.teamSize != null ||
    agent.languages.length > 0 ||
    priceRange != null ||
    Boolean(agent.reraNumber) ||
    Boolean(agent.gstNumber);

  return (
    <>
      <JsonLd data={jsonld} />

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        {/* Banner */}
        {agent.bannerImage?.startsWith("https://res.cloudinary.com/") && (
          <div className="relative mb-6 aspect-[3/1] w-full overflow-hidden rounded-card bg-ink-50 ring-1 ring-border">
            <Image
              src={agent.bannerImage}
              alt={`${agent.businessName} banner`}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

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

            {agent.tagline && (
              <p className="mt-1 text-muted-foreground">{agent.tagline}</p>
            )}

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

          {/* CTA — shared rule: WhatsApp when Zenith-connected, else point to listings */}
          <div className="sm:ml-auto">
            {contactMode === "whatsapp" && agent.zenithNumber ? (
              <PropertyContactButton
                mode="whatsapp"
                whatsappNumber={agent.zenithNumber}
                dealerName={agent.businessName}
                profileSlug={agent.slug}
                size="md"
              />
            ) : (
              <p className="max-w-[16rem] text-meta text-muted-foreground">
                Tap <span className="font-medium text-ink-800">Contact Us</span> on any listing
                below to reach {agent.businessName}.
              </p>
            )}
          </div>
        </header>

        {/* About (sanitized server-side) */}
        {agent.about && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-ink-950">
              About {agent.businessName}
            </h2>
            <div
              className="nb-prose max-w-prose text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: agent.about }}
            />
          </section>
        )}

        {/* What they offer */}
        {(agent.dealTypes.length > 0 || agent.serviceLocalities.length > 0) && (
          <section className="mb-8 grid gap-6 sm:grid-cols-2">
            {agent.dealTypes.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-950">Deals in</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.dealTypes.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-meta font-medium text-ink-800"
                    >
                      {DEAL_LABEL[d] ?? d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {agent.serviceLocalities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-950">Service areas</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.serviceLocalities.map((l) => (
                    <Link
                      key={`${l.citySlug}/${l.localitySlug}`}
                      href={`/${l.citySlug}/${l.localitySlug}`}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-meta font-medium text-ink-800 hover:bg-surface-muted"
                    >
                      {l.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Details */}
        {hasDetails && (
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-ink-950">Details</h3>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {agent.establishedYear != null && (
                <Detail icon={CalendarDays} label="Established" value={String(agent.establishedYear)} />
              )}
              {agent.yearsExperience != null && (
                <Detail icon={Clock} label="Experience" value={`${agent.yearsExperience} years`} />
              )}
              {agent.teamSize != null && (
                <Detail icon={Users} label="Team size" value={String(agent.teamSize)} />
              )}
              {agent.languages.length > 0 && (
                <Detail icon={Languages} label="Languages" value={agent.languages.join(", ")} />
              )}
              {priceRange && <Detail icon={IndianRupee} label="Price range" value={priceRange} />}
              {agent.reraNumber && <Detail icon={Tag} label="RERA" value={agent.reraNumber} />}
              {agent.gstNumber && <Detail icon={Tag} label="GST" value={agent.gstNumber} />}
            </dl>
          </section>
        )}

        {/* Working hours + contact */}
        {(agent.workingHours.length > 0 ||
          agent.officeAddress ||
          agent.publicEmail ||
          agent.publicPhone) && (
          <section className="mb-8 grid gap-6 sm:grid-cols-2">
            {agent.workingHours.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-950">
                  <Clock className="size-4 text-clay-500" /> Working hours
                </h3>
                <ul className="text-sm text-muted-foreground">
                  {agent.workingHours.map((w) => (
                    <li key={w.day} className="flex justify-between border-b border-border py-1">
                      <span>{w.day}</span>
                      <span>{w.closed ? "Closed" : `${w.open ?? ""}–${w.close ?? ""}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(agent.officeAddress || agent.publicEmail || agent.publicPhone) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-950">Contact</h3>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {agent.officeAddress && (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-clay-500" />
                      <span>
                        {agent.officeAddress}
                        {agent.mapLat != null && agent.mapLng != null && (
                          <>
                            {" · "}
                            <a
                              href={`https://www.google.com/maps?q=${agent.mapLat},${agent.mapLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-clay-700 hover:underline"
                            >
                              Map
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  )}
                  {agent.publicPhone && (
                    <li className="flex items-center gap-2">
                      <Phone className="size-4 text-clay-500" />
                      <a href={`tel:+${agent.publicPhone}`} className="hover:underline">
                        +{agent.publicPhone}
                      </a>
                    </li>
                  )}
                  {agent.publicEmail && (
                    <li className="flex items-center gap-2">
                      <Mail className="size-4 text-clay-500" />
                      <a href={`mailto:${agent.publicEmail}`} className="hover:underline">
                        {agent.publicEmail}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>
        )}

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

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border py-1.5 text-sm">
      <Icon className="size-4 shrink-0 text-clay-500" aria-hidden />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto font-medium text-ink-950">{value}</dd>
    </div>
  );
}
