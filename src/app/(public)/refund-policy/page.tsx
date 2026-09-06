import type { Metadata } from "next";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "Refund Policy — NivaasBhoomi",
  description:
    "NivaasBhoomi currently offers no paid services — listing and browsing are free — so no payments are taken and no refunds arise.",
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" lastUpdated={COMPANY.lastUpdated}>
      <LegalSection title="No paid services at present">
        <p>
          There are currently no paid services on {COMPANY.brand}. Listing a property and browsing
          listings are free. Because no payments are taken, no refunds arise.
        </p>
      </LegalSection>

      <LegalSection title="If paid features are introduced">
        <p>
          If paid features are introduced in future, this policy will be updated and the applicable
          refund window, process and timelines will be published here before any charges apply.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For any billing question, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
