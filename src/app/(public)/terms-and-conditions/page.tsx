import type { Metadata } from "next";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "Terms & Conditions — NivaasBhoomi",
  description:
    "The terms governing your use of NivaasBhoomi, a pan-India property listing and discovery platform. Please read them before using the service.",
  path: "/terms-and-conditions",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      lastUpdated={COMPANY.lastUpdated}
      intro={`These Terms & Conditions govern your use of ${COMPANY.brand} (${COMPANY.domain}). By accessing or using the platform, you agree to these terms.`}
    >
      <LegalSection title="1. Acceptance of terms">
        <p>
          By creating an account or using the platform, you accept these terms in full. If you do not
          agree, please do not use the platform.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>You must be at least 18 years old to use the platform.</p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>
          You are responsible for keeping your login credentials secure and for activity under your
          account. One phone number corresponds to one account. Providing false information may lead
          to your account being suspended or closed.
        </p>
      </LegalSection>

      <LegalSection title="4. Our role — please read">
        <p>
          <strong>
            {COMPANY.brand} is only a listing and discovery platform. We are not the owner, seller,
            broker or agent of any property.
          </strong>{" "}
          We are not a party to any transaction, payment or agreement between users. The truth,
          price, ownership and legal status of a listing are the sole responsibility of the person
          who posts it.
        </p>
      </LegalSection>

      <LegalSection title="5. Dealer obligations">
        <ul>
          <li>List only genuine properties you are authorised to advertise.</li>
          <li>Use accurate photos and correct business details.</li>
          <li>
            Duplicate, fake or misleading listings may result in your account being suspended.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Buyer obligations">
        <p>
          Send only genuine enquiries. Misuse of the platform, including spam or harassment of
          dealers, may result in a ban.
        </p>
      </LegalSection>

      <LegalSection title="7. Prohibited use">
        <ul>
          <li>Scraping or automated harvesting of data.</li>
          <li>Spam, fake listings, or posting another person&apos;s content without permission.</li>
          <li>Listing illegal property or engaging in unlawful or discriminatory conduct.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Content and licence">
        <p>
          You retain ownership of the content you upload. By uploading it, you grant {COMPANY.brand} a
          licence to host and display that content on the platform for the purpose of operating the
          service.
        </p>
      </LegalSection>

      <LegalSection title="9. Fees">
        <p>
          Browsing is free for buyers, and listing is free for dealers. Paid features may be
          introduced in future, with notice, and any charges will be made clear before you use them.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-party integrations">
        <p>
          The Zenith Code WhatsApp automation is optional and provided by a third party. If a dealer
          connects it, that service is subject to its own terms, in addition to these.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          We may suspend or terminate an account that violates these terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="12. Disclaimer and limitation of liability">
        <p>
          The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
          Listings are user-generated and we do not verify property details. To the maximum extent
          permitted by law, {COMPANY.brand} is not liable for any loss arising from a transaction
          between users or from reliance on any listing.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnity">
        <p>
          You agree to indemnify {COMPANY.brand} and its proprietor against claims arising from your
          use of the platform, your content, or your breach of these terms.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law and jurisdiction">
        <p>
          These terms are governed by the laws of India. The courts at {COMPANY.jurisdiction} have
          exclusive jurisdiction over any dispute.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes to these terms">
        <p>
          We may update these terms from time to time. Continued use after a change means you accept
          the updated terms; the &ldquo;Last updated&rdquo; date above reflects the latest version.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          Questions about these terms? Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or
          write to {COMPANY.address}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
