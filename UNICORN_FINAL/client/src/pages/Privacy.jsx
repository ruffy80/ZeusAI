import React from 'react';
import { motion } from 'framer-motion';
import SEOMeta from '../components/SEOMeta';

const LAST_UPDATED = 'June 1, 2025';

function Section({ title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      style={{ marginBottom: '2.5rem' }}
    >
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 18,
        fontWeight: 700,
        color: '#c084fc',
        margin: '0 0 0.75rem',
        letterSpacing: '0.04em',
      }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8 }}>{children}</div>
    </motion.section>
  );
}

export default function Privacy() {
  return (
    <>
      <SEOMeta
        title="Privacy Policy & GDPR"
        description="ZEUS & AI Privacy Policy. Learn how we collect, use, and protect your data. Includes GDPR rights, cookie policy, and data retention."
        canonicalPath="/legal/privacy"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ maxWidth: 820, margin: '0 auto', padding: '3rem 0 4rem' }}
      >
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 0.5rem',
        }}>
          Privacy Policy & GDPR
        </h1>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: '3rem' }}>
          Last updated: {LAST_UPDATED} · Applies to all users of the ZEUS &amp; AI Unicorn Platform.
        </p>

        <Section title="1. Who We Are">
          <p>
            ZEUS &amp; AI Unicorn Platform ("we", "us", "our"), operated by Vladoi Ionut, is the data
            controller for all personal data processed through this Platform. If you have questions
            about this policy, please contact us via the Platform.
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <p>We collect the following categories of data:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Account data:</strong> name, email address, hashed password, account creation date.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Usage data:</strong> pages visited, features used, API calls made, timestamps.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Payment data:</strong> billing address, last-4 card digits, transaction IDs (we never store full card numbers).</li>
            <li><strong style={{ color: '#e2e8f0' }}>Technical data:</strong> IP address, browser type, operating system, device identifiers.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Customer data:</strong> any content you upload or generate through the Platform.</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>We process your personal data for the following purposes:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li>To create and manage your account and authenticate your sessions.</li>
            <li>To deliver the services you have purchased or activated.</li>
            <li>To process payments and send billing notifications.</li>
            <li>To communicate service updates, security alerts, and support responses.</li>
            <li>To improve the Platform through aggregated, anonymised analytics.</li>
            <li>To detect and prevent fraud, abuse, and security incidents.</li>
            <li>To comply with legal obligations and respond to lawful requests.</li>
          </ul>
        </Section>

        <Section title="4. Legal Basis for Processing (GDPR)">
          <p>Under the GDPR, we process your personal data under the following legal bases:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Contract performance:</strong> processing necessary to deliver your subscription.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Legitimate interests:</strong> security monitoring, fraud prevention, and product improvement.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Consent:</strong> marketing communications and non-essential cookies (you may withdraw at any time).</li>
            <li><strong style={{ color: '#e2e8f0' }}>Legal obligation:</strong> compliance with applicable laws and regulations.</li>
          </ul>
        </Section>

        <Section title="5. Data Storage & Retention">
          <p>
            All data is stored on servers located within the EU (Hetzner datacentres, Germany).
            We retain account data for the duration of your account plus 30 days post-closure.
            Payment records are retained for 7 years to comply with tax regulations.
            Usage logs are retained for 90 days then automatically purged.
          </p>
          <p style={{ marginTop: 12 }}>
            Customer data is encrypted at rest using AES-256-GCM via QuantumVault and in transit
            via TLS 1.3.
          </p>
        </Section>

        <Section title="6. Third-Party Sharing">
          <p>
            We do not sell your personal data. We share data only with:
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Payment processors</strong> (Stripe, PayPal) — to complete transactions.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Infrastructure providers</strong> (Hetzner) — for hosting under GDPR-compliant DPAs.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Legal authorities</strong> — only when required by a lawful order.</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            All third-party processors are contractually bound by Data Processing Agreements (DPAs)
            that prohibit any use of your data beyond the specified purpose.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            We use the following types of cookies:
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Essential cookies:</strong> required for authentication and session management (cannot be disabled).</li>
            <li><strong style={{ color: '#e2e8f0' }}>Analytics cookies:</strong> anonymised usage tracking to improve the Platform (opt-out available).</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            We do not use third-party advertising cookies. You can manage cookie preferences in your
            account settings or browser settings.
          </p>
        </Section>

        <Section title="8. Your GDPR Rights">
          <p>As a data subject under the GDPR, you have the right to:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li><strong style={{ color: '#e2e8f0' }}>Access:</strong> request a copy of all personal data we hold about you.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Rectification:</strong> correct inaccurate or incomplete data.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Erasure:</strong> request deletion of your personal data ("right to be forgotten").</li>
            <li><strong style={{ color: '#e2e8f0' }}>Portability:</strong> receive your data in a machine-readable format (JSON or CSV).</li>
            <li><strong style={{ color: '#e2e8f0' }}>Restriction:</strong> limit the processing of your data in certain circumstances.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Objection:</strong> object to processing based on legitimate interests.</li>
            <li><strong style={{ color: '#e2e8f0' }}>Withdraw consent:</strong> at any time for consent-based processing (marketing emails, non-essential cookies).</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            To exercise any of these rights, submit a request via the Platform's account settings
            or contact us directly. We will respond within 30 days. You also have the right to lodge
            a complaint with the Romanian National Supervisory Authority (ANSPDCP).
          </p>
        </Section>

        <Section title="9. Data Breach Notification">
          <p>
            In the event of a personal data breach that poses a risk to your rights and freedoms,
            we will notify you and the relevant supervisory authority within 72 hours of becoming
            aware of the breach, as required by Article 33 of the GDPR.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy periodically. We will notify registered users by
            email of any material changes at least 14 days before they take effect. Continued use
            of the Platform after that date constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="11. Contact for Data Requests">
          <p>
            To submit a data access, deletion, or portability request, or to raise a privacy
            concern, contact Vladoi Ionut via the Platform support channel.
          </p>
          <p style={{ marginTop: 8 }}>
            BTC contact address:{' '}
            <span style={{ fontFamily: 'var(--font-heading)', color: '#c084fc', fontSize: 13 }}>
              bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
            </span>
          </p>
        </Section>
      </motion.div>
    </>
  );
}
