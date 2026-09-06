import type { Metadata } from "next";
import Link from "next/link";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "About Us — NivaasBhoomi",
  description:
    "NivaasBhoomi is a pan-India online property listing platform connecting buyers and tenants with property owners and registered dealers.",
  path: "/about-us",
});

export default function AboutUsPage() {
  return (
    <LegalPage
      title="About NivaasBhoomi"
      intro="NivaasBhoomi is a pan-India online property listing and discovery platform. Property owners and registered dealers post listings; buyers and tenants browse them and send an enquiry to the dealer directly."
    >
      <LegalSection title="The problem we solve">
        <p>
          Finding property online usually means wading through duplicate listings and handing your
          number to a dozen callers. NivaasBhoomi takes a simpler approach: a buyer sends one
          enquiry, and it reaches the dealer who owns that listing — no number farming, no spam.
        </p>
        <ul>
          <li>
            <strong>For buyers and tenants:</strong> browse listings and reach a registered dealer
            for the property you are actually interested in.
          </li>
          <li>
            <strong>For dealers:</strong> each buyer enquiry is routed to you as an exclusive lead,
            not broadcast to competitors.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Pan-India, city by city">
        <p>
          NivaasBhoomi is built for the whole of India and rolls out city by city so each area has
          real depth before it goes live, rather than a thin national listing. The platform begins
          in Ranchi and across Jharkhand, with more cities being activated over time.
        </p>
      </LegalSection>

      <LegalSection title="How it works">
        <ul>
          <li>
            <strong>1. Search:</strong> browse listings by city, locality, property type and budget.
          </li>
          <li>
            <strong>2. Enquire:</strong> send an enquiry on a listing you like.
          </li>
          <li>
            <strong>3. Connect:</strong> the enquiry reaches the listing&apos;s dealer, who contacts
            you directly.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="For dealers">
        <p>
          Listing on NivaasBhoomi is free for dealers. Post genuine properties with accurate photos
          and details, and receive buyer enquiries as exclusive leads in your dashboard. Dealers who
          use the optional Zenith Code WhatsApp automation can also have those conversations handled
          on WhatsApp.
        </p>
        <p>
          Want to list your property?{" "}
          <Link href="/dealer/login">Sign in as a dealer</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Who runs NivaasBhoomi">
        <p>
          NivaasBhoomi is operated as a {COMPANY.entityType} by its proprietor, {COMPANY.proprietor},
          based in {COMPANY.jurisdiction}. You can reach us at{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or on our{" "}
          <Link href="/contact-us">contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
