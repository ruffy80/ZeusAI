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
        color: '#00d4ff',
        margin: '0 0 0.75rem',
        letterSpacing: '0.04em',
      }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8 }}>{children}</div>
    </motion.section>
  );
}

export default function Terms() {
  return (
    <>
      <SEOMeta
        title="Terms of Service"
        description="Read the ZEUS & AI Unicorn Platform Terms of Service. Covers account obligations, payment terms, acceptable use, intellectual property, and more."
        canonicalPath="/legal/terms"
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
          Terms of Service
        </h1>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: '3rem' }}>
          Last updated: {LAST_UPDATED} · Effective immediately for all new accounts.
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using the ZEUS &amp; AI Unicorn Platform ("Platform"), you agree to be bound
            by these Terms of Service ("Terms"). If you do not agree, you must not use the Platform.
            These Terms apply to all users, including trial, free-tier, and paid subscribers.
          </p>
          <p style={{ marginTop: 12 }}>
            ZEUS &amp; AI ("we", "us", "our") reserves the right to update these Terms at any time.
            Continued use of the Platform after changes constitutes your acceptance of the new Terms.
            We will notify registered users of material changes by email.
          </p>
        </Section>

        <Section title="2. Account Obligations">
          <p>
            You must provide accurate, current, and complete registration information. You are
            responsible for maintaining the confidentiality of your credentials and for all activity
            that occurs under your account.
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li>You must be at least 18 years of age (or the legal age of majority in your jurisdiction).</li>
            <li>One person or legal entity may not maintain more than one free-tier account.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
            <li>You may not share your credentials with any third party.</li>
          </ul>
        </Section>

        <Section title="3. Payment Terms">
          <p>
            Paid subscriptions are billed on a monthly or annual basis as selected at checkout. All
            prices are in USD. Taxes may apply depending on your jurisdiction.
          </p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
            <li>Refunds are available within 14 days of initial purchase for new subscribers.</li>
            <li>Downgrades take effect at the end of the current billing period.</li>
            <li>Payment via BTC is accepted at the address listed on the Platform; crypto payments are non-refundable.</li>
            <li>We reserve the right to suspend accounts with overdue balances after a 7-day grace period.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to use the Platform to:</p>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            <li>Violate any applicable local, national, or international law or regulation.</li>
            <li>Transmit or facilitate the transmission of spam, malware, or phishing content.</li>
            <li>Attempt to gain unauthorized access to any part of the Platform or its infrastructure.</li>
            <li>Reverse-engineer, decompile, or disassemble any component of the Platform.</li>
            <li>Circumvent usage limits, rate limits, or billing controls.</li>
            <li>Use the Platform to process payments for illegal goods or services.</li>
            <li>Resell or sublicense Platform access without written permission from ZEUS &amp; AI.</li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          <p>
            All content, software, algorithms, designs, trademarks, and trade secrets on or within
            the Platform are the exclusive intellectual property of ZEUS &amp; AI or its licensors.
            Nothing in these Terms transfers any intellectual property rights to you.
          </p>
          <p style={{ marginTop: 12 }}>
            You retain ownership of all data you upload to the Platform ("Customer Data"). By using
            the Platform, you grant ZEUS &amp; AI a limited, non-exclusive licence to process your
            Customer Data solely for the purpose of delivering the services you have purchased.
          </p>
        </Section>

        <Section title="6. Service Availability & SLA">
          <p>
            We target 99.9% monthly uptime for all paid tiers and 99.99% for Enterprise plans.
            Scheduled maintenance windows will be communicated at least 24 hours in advance.
            Downtime credits are available per our SLA documentation and do not exceed one month's
            subscription fee.
          </p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, ZEUS &amp; AI shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including loss of profits, data,
            or goodwill, arising out of or in connection with your use of the Platform.
          </p>
          <p style={{ marginTop: 12 }}>
            Our total aggregate liability for any claim arising under these Terms shall not exceed
            the amount you paid to us in the 12 months preceding the event giving rise to the claim.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            You may terminate your account at any time from your account settings. We may terminate
            or suspend your account immediately if you breach these Terms, fail to pay outstanding
            amounts, or if we are required to do so by law.
          </p>
          <p style={{ marginTop: 12 }}>
            Upon termination, your right to use the Platform ceases immediately. We will retain your
            Customer Data for 30 days post-termination, after which it will be permanently deleted.
          </p>
        </Section>

        <Section title="9. Governing Law">
          <p>
            These Terms are governed by and construed in accordance with the laws of Romania.
            Any disputes arising from these Terms shall be subject to the exclusive jurisdiction
            of the courts of Romania, without regard to conflict-of-law principles.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            For legal enquiries regarding these Terms, contact us via the Platform or send a payment
            with memo to BTC address:{' '}
            <span style={{ fontFamily: 'var(--font-heading)', color: '#00d4ff', fontSize: 13 }}>
              bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
            </span>
          </p>
        </Section>
      </motion.div>
    </>
  );
}
