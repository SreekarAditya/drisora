import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";
import { PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE } from "@/lib/legal/versions";

export const metadata: Metadata = {
  title: "Privacy Policy · Drisora",
  description: "How Drisora collects, uses, stores, and protects your data.",
};

export default function DrisoraPrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" version={PRIVACY_VERSION} effectiveDate={PRIVACY_EFFECTIVE_DATE}>
      <p className="text-[#A8A8B6]">
        This Privacy Policy explains how <strong className="text-white">Drisora</strong>{" "}
        (&ldquo;Drisora&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, stores, and
        protects your information when you use the Drisora platform (the &ldquo;Service&rdquo;). It
        should be read together with our Terms of Service. We act as a data fiduciary/controller for
        account data and as a processor for the drone imagery and project content you upload.
      </p>

      <Section heading="1. Data We Collect">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-white">Account data:</strong> name, email, organization, role,
            password hash or OAuth identifier, and date of birth (used for the 18+ age check).
          </li>
          <li>
            <strong className="text-white">Consent records:</strong> the versions of the Terms and
            Privacy Policy you accepted, timestamps, age-verification result, professional-capacity
            confirmation, and the IP address at registration (see our consent audit trail).
          </li>
          <li>
            <strong className="text-white">User content:</strong> drone imagery and video, SRT/flight
            telemetry, geospatial coordinates, project and survey metadata, and the analytical outputs
            (distress detections, PCI scores, reports) derived from them.
          </li>
          <li>
            <strong className="text-white">Usage and device data:</strong> log data, IP address,
            browser/device type, pages viewed, and feature interactions, for security and product
            analytics.
          </li>
          <li>
            <strong className="text-white">Support data:</strong> communications you send us.
          </li>
        </ul>
      </Section>

      <Section heading="2. How We Use Data">
        <ul className="list-disc space-y-2 pl-6">
          <li>to provide, operate, secure, and support the Service;</li>
          <li>to run AI/ML inference on your imagery and generate your outputs;</li>
          <li>to verify eligibility (age 18+) and maintain a consent audit trail;</li>
          <li>to communicate with you about the Service, security, and legal updates;</li>
          <li>to comply with legal obligations and enforce our Terms; and</li>
          <li>to produce aggregated, de-identified analytics that do not identify you.</li>
        </ul>
        <p>
          <strong className="text-white">Legal basis (GDPR).</strong> We process personal data on the
          bases of contract (to provide the Service), legitimate interests (security, product
          improvement that does not involve training on your content), legal obligation, and consent
          (e.g., the optional model-training opt-in and certain cookies).
        </p>
      </Section>

      <Section heading="3. No Training on Your Data Without Opt-In">
        <p>
          We do <strong className="text-white">not</strong> use your uploaded imagery, content, or
          outputs to train, fine-tune, or improve our or any third party&rsquo;s machine-learning models{" "}
          <strong className="text-white">unless you give separate, explicit opt-in consent</strong>. The
          opt-in is off by default, is granular, and can be withdrawn at any time (prospectively) from
          your account settings. We do not sell your personal data or your content.
        </p>
      </Section>

      <Section heading="4. Storage, Location, and Retention">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-white">Where:</strong> data is stored with our infrastructure
            providers (e.g., Supabase/PostgreSQL with PostGIS, and object storage) in
            ap-south-1 (Mumbai), India. We apply encryption in transit (TLS) and at rest.
          </li>
          <li>
            <strong className="text-white">How long:</strong> account and consent records are retained
            for the life of your account and for 3 years thereafter where
            required for legal/audit purposes. Uploaded imagery and derived outputs are retained until
            you delete them or close your account, after which they are deleted within
            30 days, subject to backup-rotation cycles and legal holds.
          </li>
        </ul>
      </Section>

      <Section heading="5. Sharing and Sub-Processors">
        <p>
          We share data only with: (a) sub-processors that host and operate the Service under
          contract (e.g., cloud hosting, database, object storage, email); (b) authorities where
          legally compelled; and (c) parties to a corporate transaction, subject to this Policy. A list
          of sub-processors is available on request via sreekarp4@gmail.com.
        </p>
      </Section>

      <Section heading="6. International Transfers">
        <p>
          Where personal data of EU/EEA/UK users is transferred outside those regions, we rely on
          appropriate safeguards such as the European Commission&rsquo;s Standard Contractual Clauses
          (and the UK Addendum), together with supplementary measures where needed.
        </p>
      </Section>

      <Section heading="7. Cookies and Similar Technologies">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-white">Strictly necessary:</strong> authentication/session cookies
            required to log you in and keep the Service secure. These cannot be disabled.
          </li>
          <li>
            <strong className="text-white">Preferences:</strong> remember your settings.
          </li>
          <li>
            <strong className="text-white">Analytics:</strong> help us understand usage. Where required
            (EU/UK), these are set only with your consent via our cookie banner.
          </li>
        </ul>
        <p>You can manage non-essential cookies at any time through the cookie settings link in the footer.</p>
      </Section>

      <Section heading="8. Your Rights">
        <p>
          Subject to applicable law (Indian IT Act / SPDI Rules / DPDP Act and, for EU/UK users, the
          GDPR), you may: access your data; correct inaccurate data; request deletion
          (&ldquo;right to be forgotten&rdquo;); export a portable copy; restrict or object to certain
          processing; withdraw consent (including the training opt-in); and lodge a complaint with a
          supervisory authority. To exercise these rights, contact sreekarp4@gmail.com; we respond within
          the timeframe required by law.
        </p>
      </Section>

      <Section heading="9. Children">
        <p>
          The Service is strictly for users aged 18 and over. We do not knowingly collect data from
          anyone under 18. If we learn that we have, we will delete it.
        </p>
      </Section>

      <Section heading="10. Security">
        <p>
          We implement reasonable security practices and procedures consistent with the SPDI Rules,
          including access controls, encryption, and monitoring. No method of transmission or storage is
          perfectly secure; we will notify you and the relevant authority of a personal-data breach as
          required by law.
        </p>
      </Section>

      <Section heading="11. Governing Law and Contacts">
        <p>
          This Policy is governed by the laws of India (IT Act, 2000; SPDI Rules, 2011; and the DPDP
          Act, 2023 as in force), with concurrent GDPR compliance for EU/EEA/UK users.
        </p>
        <p>
          Data Protection / Grievance Officer (India): Sreekar Aditya, sreekarp4@gmail.com.
          EU Representative (Art. 27 GDPR, if applicable): Not currently appointed.
        </p>
      </Section>

      <Section heading="12. Changes to This Policy (Versioning)">
        <p>
          We may update this Policy. The version number and effective date at the top identify the
          current version. For material changes we will notify you and, where required, request renewed
          consent.
        </p>
      </Section>
    </LegalLayout>
  );
}
