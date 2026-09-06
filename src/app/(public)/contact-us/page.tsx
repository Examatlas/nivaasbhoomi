import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { ContactForm } from "@/components/public/contact-form";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "Contact Us — NivaasBhoomi",
  description:
    "Get in touch with the NivaasBhoomi team by email or through our contact form. Registered office in Ranchi, Jharkhand.",
  path: "/contact-us",
});

export default function ContactUsPage() {
  return (
    <div className="mx-auto max-w-[50rem] px-4 py-12 sm:px-6">
      <h1 className="text-display-sm">Contact us</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-800">
        Questions, feedback or a listing issue? Send us a message and we&apos;ll get back to you by
        email.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <InfoRow icon={Mail} label="Email">
          <a href={`mailto:${COMPANY.email}`} className="font-medium text-clay-700 hover:underline">
            {COMPANY.email}
          </a>
        </InfoRow>
        <InfoRow icon={Phone} label="Phone">
          {COMPANY.phone}
        </InfoRow>
        <InfoRow icon={Clock} label="Business hours">
          {COMPANY.hours}
        </InfoRow>
        <InfoRow icon={MapPin} label="Registered address">
          {COMPANY.address}
        </InfoRow>
      </dl>

      <div className="mt-10 rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-ink-950">Send a message</h2>
        <ContactForm />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-50 text-clay-700">
        <Icon className="size-4" />
      </span>
      <div>
        <dt className="text-meta text-muted-foreground">{label}</dt>
        <dd className="text-sm text-ink-900">{children}</dd>
      </div>
    </div>
  );
}
