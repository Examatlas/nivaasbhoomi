import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyCard } from "@/components/public/property-card";
import { PropertyCardSkeleton } from "@/components/public/property-card-skeleton";
import { VerificationBadge } from "@/components/public/verification-badge";
import { FreshnessIndicator } from "@/components/public/freshness-indicator";
import { InteractiveDemos } from "./interactive-demos";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

/** Color scales rendered as swatch rows. */
const SCALES: { name: string; steps: number[]; note: string }[] = [
  {
    name: "ink",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    note: "Primary - trust",
  },
  {
    name: "clay",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    note: "Accent - bhoomi / earth",
  },
  {
    name: "sand",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    note: "Neutrals - warm paper",
  },
  {
    name: "wa",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    note: "Reserved - WhatsApp only",
  },
  { name: "success", steps: [50, 100, 500, 600, 700], note: "Status" },
  { name: "warning", steps: [50, 100, 500, 600, 700], note: "Status" },
  { name: "danger", steps: [50, 100, 500, 600, 700], note: "Status" },
  { name: "info", steps: [50, 100, 500, 600, 700], note: "Status" },
];

// Computed once at module load (not during render) so the purity lint rule is
// satisfied; these drive the fresh / ageing / stale freshness examples.
const FRESHNESS_DEMO = [0, 5, 25].map((d) =>
  new Date(Date.now() - d * 86_400_000).toISOString(),
);

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-t border-border py-12 first:border-t-0"
    >
      <div className="mb-6">
        <h2 className="text-display-sm">{title}</h2>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

const NAV = [
  ["colors", "Colors"],
  ["typography", "Typography"],
  ["buttons", "Buttons"],
  ["whatsapp", "WhatsApp CTA"],
  ["badges", "Badges"],
  ["forms", "Form controls"],
  ["cards", "Card"],
  ["interactive", "Dialog / Sheet / Toast"],
  ["skeleton", "Skeleton"],
  ["property-card", "PropertyCard"],
] as const;

export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
          <p className="text-overline text-clay-600 uppercase">NivaasBhoomi</p>
          <h1 className="mt-1 text-display-md">Design System</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Every token and component in one place. Built mobile-first for mid-range
            Android, photo-forward, and calm - the opposite of the cluttered classifieds
            sites we compete with.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-border bg-surface px-3 py-1 text-meta text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-page px-4 sm:px-6">
        {/* ---------- Colors ---------- */}
        <Section
          id="colors"
          title="Colors"
          description="Deep ink for trust, warm clay for the bhoomi accent, warm sand neutrals so the page reads as paper not screen. WhatsApp green is reserved and never used for anything but the WhatsApp action."
        >
          <div className="flex flex-col gap-6">
            {SCALES.map((scale) => (
              <div key={scale.name}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold capitalize">{scale.name}</h3>
                  <span className="text-meta text-subtle-foreground">{scale.note}</span>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-11">
                  {scale.steps.map((step) => (
                    <div key={step} className="flex flex-col gap-1">
                      <div
                        className="h-12 rounded-media border border-black/5"
                        style={{ backgroundColor: `var(--color-${scale.name}-${step})` }}
                      />
                      <span className="text-center text-overline text-subtle-foreground">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Semantic aliases</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  "background",
                  "surface",
                  "surface-muted",
                  "foreground",
                  "muted-foreground",
                  "border",
                  "primary",
                  "accent",
                ].map((token) => (
                  <div key={token} className="flex flex-col gap-1">
                    <div
                      className="h-12 rounded-media border border-border"
                      style={{ backgroundColor: `var(--color-${token})` }}
                    />
                    <span className="text-center text-overline text-subtle-foreground">
                      {token}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- Typography ---------- */}
        <Section
          id="typography"
          title="Typography"
          description="Plus Jakarta Sans for display, Hind for body and Devanagari. Both self-hosted via next/font with display:swap."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                display-xl
              </span>
              <p className="text-display-xl">Ghar khareedna aasaan</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                display-lg
              </span>
              <p className="text-display-lg">Find your next home</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                display-md
              </span>
              <p className="text-display-md">Verified property across India</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                display-sm
              </span>
              <p className="text-display-sm">Featured in Ranchi</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                price-lg / price
              </span>
              <p className="tabular text-price-lg text-ink-950">₹1.25 Cr</p>
              <p className="tabular text-price text-ink-950">₹52 L</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                body (Hind) - Latin + Devanagari
              </span>
              <p className="max-w-prose text-base">
                Kanke Road, Ranchi mein 3 BHK flat. Gated society, semi-furnished, covered
                parking ke saath. Direct WhatsApp par baat karein - koi spam call nahi.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-subtle-foreground uppercase">
                meta / overline
              </span>
              <p className="text-meta text-muted-foreground">2 days ago · 1,250 sq.ft.</p>
              <p className="text-overline text-subtle-foreground uppercase">
                Verified dealer
              </p>
            </div>
          </div>
        </Section>

        {/* ---------- Buttons ---------- */}
        <Section
          id="buttons"
          title="Buttons"
          description="One primary action per surface. There is deliberately no green button here - green belongs only to the WhatsApp CTA below."
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        {/* ---------- WhatsApp ---------- */}
        <Section
          id="whatsapp"
          title="WhatsApp CTA (reserved)"
          description="The only component allowed to use the wa-* green palette. Always an anchor to a wa.me link, always the same colour, so buyers learn it instantly. Foreground is near-black for WCAG contrast on brand green."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <WhatsAppButton href="https://wa.me/919000000000" size="sm">
                WhatsApp
              </WhatsAppButton>
              <WhatsAppButton href="https://wa.me/919000000000" size="md">
                Enquire on WhatsApp
              </WhatsAppButton>
              <WhatsAppButton href="https://wa.me/919000000000" size="lg">
                Enquire on WhatsApp
              </WhatsAppButton>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <WhatsAppButton href="https://wa.me/919000000000" tone="soft">
                Soft (dense contexts)
              </WhatsAppButton>
            </div>
            <div className="max-w-sm">
              <WhatsAppButton href="https://wa.me/919000000000" block>
                Enquire on WhatsApp
              </WhatsAppButton>
            </div>
          </div>
        </Section>

        {/* ---------- Badges ---------- */}
        <Section id="badges" title="Badges">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="ink">Ink</Badge>
              <Badge tone="clay">Clay</Badge>
              <Badge tone="verified">Verified</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="outline">Outline</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge tier={1} />
              <VerificationBadge tier={2} />
              <VerificationBadge tier={3} />
              <VerificationBadge tier={4} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {FRESHNESS_DEMO.map((iso) => (
                <FreshnessIndicator key={iso} refreshedAt={iso} />
              ))}
            </div>
          </div>
        </Section>

        {/* ---------- Forms ---------- */}
        <Section id="forms" title="Form controls">
          <div className="grid max-w-xl gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ds-name" required>
                Full name
              </Label>
              <Input id="ds-name" placeholder="e.g. Ramesh Kumar" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ds-phone">WhatsApp number</Label>
              <Input id="ds-phone" type="tel" placeholder="98XXXXXXXX" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ds-err">Invalid state</Label>
              <Input id="ds-err" invalid defaultValue="not-an-email" />
              <span className="text-meta text-danger-600">
                Enter a valid email address.
              </span>
            </div>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-medium">Amenities</legend>
              {["Covered parking", "Power backup", "Lift"].map((a, i) => (
                <label key={a} className="flex items-center gap-2.5 text-sm">
                  <Checkbox defaultChecked={i === 0} /> {a}
                </label>
              ))}
            </fieldset>
          </div>
        </Section>

        {/* ---------- Card ---------- */}
        <Section id="cards" title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>City readiness</CardTitle>
                <CardDescription>
                  Ranchi needs 25 listings, 5 verified dealers and 3 active localities to
                  go live.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Elevation comes from a 1px border on the warm ground, not a heavy
                  shadow.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Activate city</Button>
                <Button size="sm" variant="ghost">
                  Details
                </Button>
              </CardFooter>
            </Card>
            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>Hovers with a restrained lift.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Used where the whole surface is a link.
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ---------- Interactive ---------- */}
        <Section
          id="interactive"
          title="Dialog / Sheet / Toast / Select"
          description="Dialogs and Sheets are for user-initiated actions only - never to gate listing content behind a wall the way competitors do."
        >
          <InteractiveDemos />
        </Section>

        {/* ---------- Skeleton ---------- */}
        <Section id="skeleton" title="Skeleton">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-11 w-40 rounded-control" />
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-6 w-64 rounded-md" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <PropertyCardSkeleton />
              <PropertyCardSkeleton />
            </div>
          </div>
        </Section>

        {/* ---------- PropertyCard ---------- */}
        <Section
          id="property-card"
          title="PropertyCard"
          description="The most important component on the site. Photo-forward, price-led, honest freshness and verification, one WhatsApp action. Shown across sale, rent, plot and premium variants."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_LISTINGS.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        </Section>

        <div className="py-16" />
      </div>
    </div>
  );
}
