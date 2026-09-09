import type { Metadata } from "next";

import { staticPageMetadata } from "@/lib/seo/metadata";
import { LegalPage, LegalSection } from "@/components/public/legal-page";
import { COMPANY } from "@/lib/legal/company";

export const revalidate = 86400;

export const metadata: Metadata = staticPageMetadata({
  title: "Privacy Policy — NivaasBhoomi",
  description:
    "How NivaasBhoomi collects, uses, shares and protects your personal data, in line with India's Digital Personal Data Protection Act, 2023.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={COMPANY.lastUpdated}
      intro={`This Privacy Policy explains how ${COMPANY.brand} collects, uses, shares and protects your personal data. It is designed to be consistent with India's Digital Personal Data Protection Act, 2023 (the "DPDP Act"). By using the platform you agree to this policy.`}
    >
      <LegalSection title="1. Introduction">
        <p>
          {COMPANY.brand} ({COMPANY.domain}) is a pan-India online property listing platform operated
          as a {COMPANY.entityType} by {COMPANY.proprietor}. This policy is effective from the
          &ldquo;Last updated&rdquo; date above and applies to everyone who uses the platform.
        </p>
      </LegalSection>

      <LegalSection title="2. What data we collect">
        <ul>
          <li>Your name, phone number and email address.</li>
          <li>A hashed password, if you use a password-based login.</li>
          <li>Your city and location, which you share or which we detect to personalise listings.</li>
          <li>Listing details and photos that dealers upload.</li>
          <li>Dealer business details, including GST, Udyam and RERA numbers where provided.</li>
          <li>Enquiry messages you send to dealers.</li>
          <li>Device and log data, such as IP address, browser type and access times.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we collect it">
        <p>
          We collect data that you provide directly — when you sign up, post a listing or send an
          enquiry — and data collected automatically through cookies and server logs as you use the
          platform.
        </p>
      </LegalSection>

      <LegalSection title="4. Why we use your data">
        <ul>
          <li>To create your account and sign you in, including via WhatsApp OTP.</li>
          <li>To display listings and personalise what you see by location.</li>
          <li>To deliver a buyer&apos;s enquiry to the relevant dealer.</li>
          <li>To operate, maintain and improve the platform.</li>
          <li>To detect and prevent fraud and misuse.</li>
          <li>To comply with applicable law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. WhatsApp and Meta">
        <p>
          To send login codes and service notifications, your phone number is shared with the
          WhatsApp Business Platform operated by Meta. This is used to deliver those messages to you
          and is subject to Meta&apos;s own terms and privacy practices.
        </p>
      </LegalSection>

      <LegalSection title="6. Lead sharing — please read">
        <p>
          <strong>
            When you send an enquiry on a listing, your name and phone number are shared with the
            dealer who owns that listing
          </strong>{" "}
          so that the dealer can contact you about the property. This is the core purpose of the
          platform. Do not send an enquiry if you do not want the dealer to receive your contact
          details.
        </p>
      </LegalSection>

      <LegalSection title="7. Who we share data with">
        <p>
          We share data with the service providers that run the platform: MongoDB Atlas (database),
          Vercel (hosting), Cloudinary (image storage), Google Maps (location), Resend (email),
          the WhatsApp Business Platform / Meta (messaging), Google Analytics (anonymous usage
          analytics), and Zenith Code (optional WhatsApp automation, where a dealer connects it).
          We may also disclose data to authorities where the law requires it.
        </p>
        <p>
          <strong>We do not sell your personal data, and we do not share it with advertisers.</strong>
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          We use cookies that are necessary for authentication and sessions, and Google Analytics 4
          to understand how the platform is used (which pages and tools are popular). Analytics
          records only anonymous usage — page views, categories and event counts. We never send your
          name, phone number or email to Google Analytics.
        </p>
      </LegalSection>

      <LegalSection title="9. Data retention">
        <p>
          We keep your data for as long as your account is active, and for a reasonable period
          afterwards to meet legal, accounting or fraud-prevention needs, after which it is deleted
          or anonymised.
        </p>
      </LegalSection>

      <LegalSection title="10. Your rights">
        <p>
          Under the DPDP Act you may request access to your personal data, correction of inaccurate
          data, erasure of your data, and withdrawal of consent. To exercise any of these, email us
          at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>
      </LegalSection>

      <LegalSection title="11. Security">
        <p>
          Data is transmitted over HTTPS, passwords are stored only as secure hashes, and
          third-party access tokens are encrypted at rest. No system is perfectly secure, but we take
          reasonable measures to protect your data.
        </p>
      </LegalSection>

      <LegalSection title="12. Children">
        <p>The platform is not intended for anyone under the age of 18.</p>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be notified on this page
          by updating the &ldquo;Last updated&rdquo; date, and where appropriate through the platform.
        </p>
      </LegalSection>

      <LegalSection title="14. Grievance Officer">
        <p>
          For any privacy concern or grievance, contact our Grievance Officer:
        </p>
        <ul>
          <li>{COMPANY.proprietor}</li>
          <li>
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </li>
          <li>{COMPANY.address}</li>
        </ul>
        <p>We aim to acknowledge and respond to grievances within 30 days.</p>
      </LegalSection>
    </LegalPage>
  );
}
