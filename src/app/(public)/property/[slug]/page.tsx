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
  Calculator,
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
import { PropertyContactButton } from "@/components/public/property-contact-button";
import { SeedContactNotice } from "@/components/public/seed-contact-notice";
import { resolveContactMode } from "@/lib/leads/contact-mode";
import { JsonLd } from "@/components/shared/json-ld";
import { PropertyGallery } from "@/components/public/property-gallery";
import { PropertyMap } from "@/components/public/property-map";
import { VerificationBadge } from "@/components/public/verification-badge";
import { FreshnessIndicator } from "@/components/public/freshness-indicator";
import { SectionNav, type Section } from "@/components/public/section-nav";
import { SaveButton } from "@/components/public/save-button";
import { ShareButton } from "@/components/public/share-button";
import { ListingId } from "@/components/public/listing-id";
import { ReportListing } from "@/components/public/report-listing";
import { EmiCalculator } from "@/components/public/emi-calculator";
import { ListingGrid } from "@/components/public/listing-grid";
import { getSimilarListings } from "@/lib/listings/query";
import { possessionLabel } from "@/lib/utils/listing-format";
import { seedPhotoCredit } from "@/lib/listings/seed-credits";
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
  const meta = propertyMetadata({
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
  // Seed (display-only) listings are noindex, nofollow — deleting them later
  // must not leave an indexed 404.
  if (l.isSeed) meta.robots = { index: false, follow: false };
  return meta;
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
  // Representative area for JSON-LD floorSize + the single-value fallbacks.
  const area = l.carpetArea ?? l.builtUpArea ?? l.superBuiltUpArea ?? l.plotArea;
  const freshness = getFreshness(l.refreshedAt);
  const possession = possessionLabel(l.possessionStatus);

  // Similar listings (same city + type + purpose, ±25% price). Seeds get none.
  const similar = l.isSeed
    ? []
    : await getSimilarListings({
        listingId: l.id,
        cityId: l.cityId,
        cityName: l.cityName,
        propertyType: l.propertyType,
        purpose: l.purpose,
        price: l.price,
      });

  // In-page section nav. Amenities only appears when there's something to show.
  const hasAmenities = Boolean(
    l.amenities?.length || l.furnishingDetails?.length || l.parking || l.waterSource?.length,
  );
  const sections: Section[] = [
    { id: "overview", label: "Overview" },
    ...(hasAmenities ? [{ id: "amenities", label: "Amenities" }] : []),
    ...(l.lat != null && l.lng != null ? [{ id: "location", label: "Location" }] : []),
    ...(l.dealer ? [{ id: "dealer", label: "Dealer" }] : []),
  ];

  // Per-dealer button mode: "whatsapp" (into the dealer's Zenith automation) when
  // the dealer is Zenith-connected, else "contact". The wa.me link (with the
  // listing ref, DEV-SPEC.txt Section 11) is built client-side from
  // window.location.origin — see PropertyContactButton — so it always uses the
  // live domain, never a build-time-baked origin.
  const contactMode = resolveContactMode(l.dealer);

  // Absolute image URLs for JSON-LD / OG.
  const imageUrls = l.photos
    .map((p) => photoUrl(p, "gallery"))
    .map((u) => (u.startsWith("http") ? u : absoluteUrl(u)));

  // Seed listings emit NO listing structured data (only breadcrumb nav) — so a
  // demo listing never appears as a real property in search results.
  const jsonld = l.isSeed
    ? [
        breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: l.cityName, url: `/${l.citySlug}` },
          { name: l.localityName, url: `/${l.citySlug}/${l.localitySlug}` },
          { name: l.title, url: `/property/${l.slug}` },
        ]),
      ]
    : [
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

        {/* Sticky in-page section nav (Overview / Amenities / Location / Dealer). */}
        <SectionNav sections={sections} />

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: gallery + details */}
          <div className="flex flex-col gap-6">
            <PropertyGallery
              photos={l.photos}
              coverIndex={l.coverPhotoIndex}
              title={l.title}
            />

            {/* Reference id + share / save. Save is account-based (buyer auth);
                seed (display-only) listings are not shortlistable. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ListingId id={l.id} />
              <div className="flex items-center gap-2">
                <ShareButton path={`/property/${l.slug}`} title={l.title} variant="inline" />
                {!l.isSeed && <SaveButton listingId={l.id} variant="inline" />}
              </div>
            </div>

            {/* Header (price + title) - shown here on mobile; sidebar repeats on desktop */}
            <div className="lg:hidden">
              <PriceHeader
                listing={l}
                priceLabel={price.primary}
                priceSuffix={price.suffix}
              />
              <div className="mt-3">
                {l.isSeed ? (
                  <SeedContactNotice cityId={l.cityId} localityId={l.localityId} purpose={l.purpose} />
                ) : (
                  <PropertyContactButton
                    listingId={l.id}
                    listingTitle={l.title}
                    dealerName={l.dealer?.businessName}
                    mode={contactMode}
                    whatsappNumber={l.dealer?.zenithNumber ?? undefined}
                    listingSlug={l.slug}
                    block
                  />
                )}
              </div>
            </div>

            {/* Key specs */}
            <Card id="overview" className="scroll-mt-32 p-5">
              <h2 className="mb-4 text-lg font-semibold text-ink-950">Overview</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {l.bhk && !isPlot && (
                  <Spec icon={BedDouble} label="Configuration" value={formatBhk(l.bhk)} />
                )}
                {/* Carpet / Built-up / Super built-up shown separately when known;
                    for a plot only the plot area applies. */}
                {isPlot ? (
                  l.plotArea ? (
                    <Spec icon={Maximize} label="Plot area" value={formatArea(l.plotArea)} />
                  ) : null
                ) : (
                  <>
                    {l.carpetArea ? (
                      <Spec icon={Maximize} label="Carpet area" value={formatArea(l.carpetArea)} />
                    ) : null}
                    {l.builtUpArea ? (
                      <Spec icon={Maximize} label="Built-up area" value={formatArea(l.builtUpArea)} />
                    ) : null}
                    {l.superBuiltUpArea ? (
                      <Spec
                        icon={Maximize}
                        label="Super built-up"
                        value={formatArea(l.superBuiltUpArea)}
                      />
                    ) : null}
                    {/* Fallback so a listing with none of the three still shows an area. */}
                    {!l.carpetArea && !l.builtUpArea && !l.superBuiltUpArea && area ? (
                      <Spec icon={Maximize} label="Area" value={formatArea(area)} />
                    ) : null}
                  </>
                )}
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
                {l.projectName && (
                  <Spec icon={Building2} label="Project" value={l.projectName} />
                )}
                {/* Possession: the exact date when known, else the status label. */}
                {l.possessionDate ? (
                  <Spec
                    icon={CalendarClock}
                    label="Possession"
                    value={new Date(l.possessionDate).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  />
                ) : possession ? (
                  <Spec icon={CalendarClock} label="Possession" value={possession} />
                ) : null}
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
              {l.isSeed && (
                <div className="mt-3 flex flex-col gap-0.5">
                  <p className="text-meta text-subtle-foreground">Demo listing — for reference only</p>
                  {seedPhotoCredit(l.title) && (
                    <p className="text-meta text-subtle-foreground">
                      Photo: {seedPhotoCredit(l.title)} / Pexels
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Amenities / furnishing / utilities */}
            {(l.amenities?.length ||
              l.furnishingDetails?.length ||
              l.parking ||
              l.waterSource?.length) && (
              <Card id="amenities" className="scroll-mt-32 p-5">
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
                <Row label="Possession" value={possession} />
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

            {/* EMI estimator — sale listings only, prefilled with the asking price. */}
            {l.purpose === "sale" && (
              <Card className="p-5">
                <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink-950">
                  <Calculator className="size-5 text-clay-600" /> EMI estimate
                </h2>
                <p className="mb-4 text-meta text-muted-foreground">
                  A rough monthly instalment for this price. Adjust the loan amount, rate and tenure.
                </p>
                <EmiCalculator initialPrincipal={l.price} />
              </Card>
            )}

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
              <Card id="location" className="scroll-mt-32 p-5">
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

            {/* Dealer — in the content flow so it's an anchor target on every
                breakpoint (the sticky sidebar only exists on desktop). */}
            {l.dealer && (
              <div id="dealer" className="scroll-mt-32">
                <DealerCard dealer={l.dealer} />
              </div>
            )}

            {/* Report — a quiet trust affordance at the end of the content. */}
            <div className="flex justify-end">
              <ReportListing listingId={l.id} />
            </div>
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
                  {l.isSeed ? (
                    <SeedContactNotice cityId={l.cityId} localityId={l.localityId} purpose={l.purpose} />
                  ) : (
                    <PropertyContactButton
                      listingId={l.id}
                      listingTitle={l.title}
                      dealerName={l.dealer?.businessName}
                      mode={contactMode}
                      whatsappNumber={l.dealer?.zenithNumber ?? undefined}
                      listingSlug={l.slug}
                      block
                    />
                  )}
                </div>
                {!l.isSeed && (
                  <p className="mt-2 text-center text-meta text-muted-foreground">
                    No spam. The verified dealer contacts you directly.
                  </p>
                )}
              </Card>

              <FreshnessNote refreshedAt={l.refreshedAt} days={freshness.days} />
            </div>
          </aside>
        </div>

        {/* Similar properties — same city + type + purpose, ±25% price. */}
        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 text-display-sm">Similar properties</h2>
            <ListingGrid listings={similar} />
          </section>
        )}
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
          {l.isSeed ? (
            <span className="text-meta text-muted-foreground">In verification</span>
          ) : (
            <PropertyContactButton
              listingId={l.id}
              listingTitle={l.title}
              dealerName={l.dealer?.businessName}
              mode={contactMode}
              whatsappNumber={l.dealer?.zenithNumber ?? undefined}
              listingSlug={l.slug}
              triggerLabel="Contact"
              size="md"
            />
          )}
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
        {l.isCntLand && (
          <Badge tone="neutral" size="sm">
            CNT
          </Badge>
        )}
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
