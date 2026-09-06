import type { Metadata } from "next";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "Disclaimer — NivaasBhoomi",
  description:
    "Listings on NivaasBhoomi are user-generated and unverified. Verify property details and title independently before any transaction.",
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" lastUpdated={COMPANY.lastUpdated}>
      <LegalSection title="Listings are user-generated">
        <p>
          All listings on {COMPANY.brand} are posted by users (property owners and dealers). We do
          not verify the contents of a listing. A verified badge, where shown, reflects checks on a
          dealer&apos;s identity only — it is not a verification of any property, its price, ownership
          or legal status.
        </p>
      </LegalSection>

      <LegalSection title="Price and availability">
        <p>
          Prices and availability shown on the platform may change and can be out of date. Confirm
          current details directly with the dealer.
        </p>
      </LegalSection>

      <LegalSection title="Do your own due diligence">
        <p>
          Before buying, renting or making any payment, carry out your own legal due diligence and
          title verification. Do not rely solely on information shown on the platform.
        </p>
      </LegalSection>

      <LegalSection title="CNT / SPT tags">
        <p>
          Any CNT or SPT tag on a listing is declared by the dealer and is not verified by the
          platform. Confirm the actual land status independently.
        </p>
      </LegalSection>

      <LegalSection title="Map locations">
        <p>Locations shown on Google Maps are approximate and may not be exact.</p>
      </LegalSection>

      <LegalSection title="No liability for transactions">
        <p>
          {COMPANY.brand} is not a party to any transaction between users and is not responsible for
          any loss arising from a transaction or from reliance on any listing.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
