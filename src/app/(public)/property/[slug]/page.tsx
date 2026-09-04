import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Building2,
  Compass,
  CalendarClock,
  ShieldCheck,
  ScrollText,
  Home,
} from "lucide-react";

import { getPublicListing, getApprovedListingSlugs } from "@/lib/listings/public";
import { propertyMetadata } from "@/lib/seo/metadata";
import {
  realEstateListingJsonLd,
  productOfferJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/site";
import { photoUrl, ogImageUrl } from "@/lib/media/transforms";
import {
  formatListingPrice,
  formatBhk,
  formatArea,
  formatFurnishing,
  formatPropertyType,
  formatPricePerSqft,
  groupINR,
} from "@/lib/utils/price";
import { getFreshness } from "@/lib/utils/date";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { JsonLd } from "@/components/shared/json-ld";
import { PropertyGallery } from "@/components/public/property-gallery";
import { PropertyMap } from "@/components/public/property-map";
import { VerificationBadge } from "@/components/public/verification-badge";
import { FreshnessIndicator } from "@/components/public/freshness-indicator";
import type { PublicListingDetail } from "@/types/property";

export const revalidate = 3600; // ISR (Section 9)

// One DB resolve per request, shared by generateMetadata and the page.
const load = cache(getPublicListing);

export async function generateStaticParams() {
  const slugs = await getApprovedListingSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/property/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await load(slug);
  if (result.kind !== "ok") {
    return { title: "Property not found", robots: { index: false, follow: false } };
  }
  const l = result.listing;
  const cover = l.photos[l.coverPhotoIndex] ?? l.photos[0];
  return propertyMetadata({
    slug: l.slug,
    bhk: l.bhk,
    propertyType: l.propertyType,
    purpose: l.purpose,
    localityName: l.localityName,
    cityName: l.cityName,
    price: l.price,
    description: l.description,
    image: ogImageUrl(cover),
  });
}

export default async function PropertyPage({ params }: PageProps<"/property/[slug]">) {
  const { slug } = await params;
  const result = await load(slug);

  // Section 9 visibility rules.
  if (result.kind === "expired") permanentRedirect(result.localityPath);
  if (result.kind === "deleted") notFound(); // TODO: a route handler could serve a true 410
  if (result.kind !== "ok") notFound();

  const l = result.listing;
  const price = formatListingPrice(l.purpose, l.price);
  const isPlot = l.propertyType === "plot";
  const area = l.carpetArea ?? l.builtUpArea ?? l.plotArea;
  const freshness = getFreshness(l.refreshedAt);

  // Absolute image URLs for JSON-LD / OG.
  const imageUrls = l.photos
    .map((p) => photoUrl(p, "gallery"))
    .map((u) => (u.startsWith("http") ? u : absoluteUrl(u)));

  const jsonld = [
    realEstateListingJsonLd({
      slug: l.slug,
      title: l.title,
      description: l.description,
      purpose: l.purpose,
      price: l.price,
      images: imageUrls,
      localityName: l.localityName,
      cityName: l.cityName,
      areaSqft: area,
      bhk: l.bhk,
    }),
    productOfferJsonLd({
      slug: l.slug,
      title: l.title,
      description: l.description,
      purpose: l.purpose,
      price: l.price,
      images: imageUrls,
      localityName: l.localityName,
      cityName: l.cityName,
    }),
    breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: l.cityName, url: `/${l.citySlug}` },
      { name: l.localityName, url: `/${l.citySlug}/${l.localitySlug}` },
      { name: l.title, url: `/property/${l.slug}` },
    ]),
  ];

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
          <Link href={`/${l.citySlug}`} className="hover:text-foreground">
            {l.cityName}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/${l.citySlug}/${l.localitySlug}`}
            className="hover:text-foreground"
          >
            {l.localityName}
          </Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: gallery + details */}
          <div className="flex flex-col gap-6">
            <PropertyGallery
              photos={l.photos}
              coverIndex={l.coverPhotoIndex}
              title={l.title}
            />

            {/* Header (price + title) - shown here on mobile; sidebar repeats on desktop */}
            <div className="lg:hidden">
              <PriceHeader
                listing={l}
                priceLabel={price.primary}
                priceSuffix={price.suffix}
              />
              <div className="mt-3">
                <EnquiryForm listingId={l.id} listingTitle={l.title} block />
              </div>
            </div>

            {/* Key specs */}
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-semibold text-ink-950">Overview</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {l.bhk && !isPlot && (
                  <Spec icon={BedDouble} label="Configuration" value={formatBhk(l.bhk)} />
                )}
                {area ? (
                  <Spec icon={Maximize} label="Area" value={formatArea(area)} />
                ) : null}
                {l.bathrooms != null && !isPlot && (
                  <Spec icon={Bath} label="Bathrooms" value={String(l.bathrooms)} />
                )}
                {l.floor != null && !isPlot && (
                  <Spec
                    icon={Building2}
                    label="Floor"
                    value={`${l.floor}${l.totalFloors ? ` of ${l.totalFloors}` : ""}`}
                  />
                )}
                {l.furnishing && (
                  <Spec
                    icon={Home}
                    label="Furnishing"
                    value={formatFurnishing(l.furnishing)}
                  />
                )}
                {l.facing && <Spec icon={Compass} label="Facing" value={l.facing} />}
                {l.ageOfProperty && (
                  <Spec icon={CalendarClock} label="Age" value={l.ageOfProperty} />
                )}
                {l.pricePerSqft ? (
                  <Spec
                    icon={Maximize}
                    label="Rate"
                    value={formatPricePerSqft(l.pricePerSqft)}
                  />
                ) : null}
                <Spec
                  icon={Building2}
                  label="Type"
                  value={formatPropertyType(l.propertyType)}
                />
              </div>
            </Card>

            {/* Description */}
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-semibold text-ink-950">
                About this property
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {l.description}
              </p>
            </Card>

            {/* Amenities / furnishing / utilities */}
            {(l.amenities?.length ||
              l.furnishingDetails?.length ||
              l.parking ||
              l.waterSource?.length) && (
              <Card className="p-5">
                <h2 className="mb-4 text-lg font-semibold text-ink-950">
                  Amenities & features
                </h2>
                <div className="flex flex-col gap-4">
                  <ChipRow title="Amenities" items={l.amenities} />
                  <ChipRow title="Furnishing" items={l.furnishingDetails} />
                  <ChipRow title="Water source" items={l.waterSource} />
                  {l.parking && <ChipRow title="Parking" items={[l.parking]} />}
                </div>
              </Card>
            )}

            {/* Possession & legal */}
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink-950">
                <ScrollText className="size-5 text-clay-600" /> Possession & legal
              </h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                <Row label="Possession" value={l.possessionStatus} />
                <Row label="Ownership" value={l.ownershipType} />
                <Row label="RERA number" value={l.reraNumber} />
                <Row label="RERA state" value={l.reraStateName} />
                <Row label="Approved by" value={l.approvedBy?.join(", ")} />
                {l.purpose === "sale" && l.bookingAmount ? (
                  <Row label="Booking amount" value={`₹${groupINR(l.bookingAmount)}`} />
                ) : null}
                {l.purpose === "rent" && l.securityDeposit ? (
                  <Row
                    label="Security deposit"
                    value={`₹${groupINR(l.securityDeposit)}`}
                  />
                ) : null}
                {l.maintenanceCharge ? (
                  <Row
                    label="Maintenance"
                    value={`₹${groupINR(l.maintenanceCharge)} / month`}
                  />
                ) : null}
                {/* Brokerage shown openly (transparency, Section 4) */}
                <Row label="Brokerage" value={l.brokerage ?? "Not specified"} />
                {l.purpose === "rent" && l.availableFrom ? (
                  <Row
                    label="Available from"
                    value={new Date(l.availableFrom).toLocaleDateString()}
                  />
                ) : null}
                {l.purpose === "rent" && l.preferredTenant?.length ? (
                  <Row label="Preferred tenant" value={l.preferredTenant.join(", ")} />
                ) : null}
              </dl>
            </Card>

            {/* Video */}
            {l.video?.url && (
              <Card className="p-5">
                <h2 className="mb-3 text-lg font-semibold text-ink-950">Video tour</h2>
                {/* muted + playsInline + controls, NOT autoplay (Section 14) */}
                <video
                  controls
                  muted
                  playsInline
                  preload="none"
                  className="aspect-video w-full rounded-media bg-black"
                  src={l.video.url}
                />
              </Card>
            )}

            {/* Location map */}
            {l.lat != null && l.lng != null && (
              <Card className="p-5">
                <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink-950">
                  <MapPin className="size-5 text-clay-600" /> Location
                </h2>
                <p className="mb-3 text-meta text-muted-foreground">
                  {[l.landmark, l.subLocality, l.localityName, l.cityName]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <PropertyMap lat={l.lat} lng={l.lng} label={l.title} />
              </Card>
            )}
          </div>

          {/* Right: sticky desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 flex flex-col gap-4">
              <Card className="p-5">
                <PriceHeader
                  listing={l}
                  priceLabel={price.primary}
                  priceSuffix={price.suffix}
                />
                <div className="mt-4">
                  <EnquiryForm listingId={l.id} listingTitle={l.title} block />
                </div>
                <p className="mt-2 text-center text-meta text-muted-foreground">
                  No spam. The verified dealer contacts you directly.
                </p>
              </Card>

              {l.dealer && <DealerCard dealer={l.dealer} />}

              <FreshnessNote refreshedAt={l.refreshedAt} days={freshness.days} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky CTA bar */}
      <div className="sticky bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-page items-center gap-3 px-1">
          <div className="min-w-0 flex-1">
            <p className="tabular truncate text-price text-ink-950">
              {price.primary}
              {price.suffix && (
                <span className="text-sm text-muted-foreground">{price.suffix}</span>
              )}
            </p>
          </div>
          <EnquiryForm listingId={l.id} listingTitle={l.title} triggerLabel="Enquire" size="md" />
        </div>
      </div>
    </>
  );
}

// ---- small presentational helpers ----

function PriceHeader({
  listing,
  priceLabel,
  priceSuffix,
}: {
  listing: PublicListingDetail;
  priceLabel: string;
  priceSuffix?: string;
}) {
  const l = listing;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={l.purpose === "rent" ? "clay" : "ink"} size="sm">
          {l.purpose === "rent" ? "For Rent" : "For Sale"}
        </Badge>
        {l.dealer && l.dealer.verificationTier >= 1 && (
          <VerificationBadge tier={l.dealer.verificationTier} size="sm" />
        )}
        {l.badges.documentsChecked && (
          <Badge tone="success" size="sm">
            <ShieldCheck /> Documents checked
          </Badge>
        )}
      </div>
      <p className="tabular mt-3 text-price-lg text-ink-950">
        {priceLabel}
        {priceSuffix && (
          <span className="ml-1 text-base font-medium text-muted-foreground">
            {priceSuffix}
          </span>
        )}
      </p>
      <h1 className="mt-1 text-xl leading-snug font-semibold text-ink-950">{l.title}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground">
        <MapPin className="size-3.5 text-clay-500" /> {l.localityName}, {l.cityName}
      </p>
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-sand-500" aria-hidden />
      <div>
        <p className="text-overline text-subtle-foreground uppercase">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ChipRow({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-overline text-subtle-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Badge key={it} tone="neutral">
            {it}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function DealerCard({ dealer }: { dealer: NonNullable<PublicListingDetail["dealer"]> }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-950">Listed by</h2>
      <div className="flex items-center gap-2">
        {dealer.slug ? (
          <Link
            href={`/agent/${dealer.slug}`}
            className="font-medium text-ink-950 hover:underline"
          >
            {dealer.businessName}
          </Link>
        ) : (
          <span className="font-medium text-ink-950">{dealer.businessName}</span>
        )}
        {dealer.verificationTier >= 1 && (
          <VerificationBadge tier={dealer.verificationTier} size="sm" />
        )}
      </div>
      {dealer.ratingCount > 0 && (
        <p className="mt-1 text-meta text-muted-foreground">
          ★ {dealer.rating.toFixed(1)} ({dealer.ratingCount} reviews)
        </p>
      )}
      {dealer.avgResponseMinutes != null && (
        <p className="mt-1 text-meta text-success-700">
          Usually responds in ~{dealer.avgResponseMinutes} min
        </p>
      )}
      {/* Dealer phone/email are NEVER shown - contact is via WhatsApp only. */}
    </Card>
  );
}

function FreshnessNote({ refreshedAt, days }: { refreshedAt: string; days: number }) {
  return (
    <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
      <FreshnessIndicator refreshedAt={refreshedAt} />
      <span className="text-meta text-subtle-foreground">
        {days === 0 ? "Posted today" : `Updated ${days}d ago`}
      </span>
    </div>
  );
}
