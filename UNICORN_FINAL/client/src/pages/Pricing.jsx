import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';
import PricingCard from '../components/PricingCard';
import useLivePricing from '../hooks/useLivePricing';

const PLANS_MONTHLY = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    period: 'mo',
    description: 'Explore the platform with core modules and a sandboxed environment.',
    features: [
      '5 AI modules (read-only)',
      'Sandboxed environment',
      'Community support',
      '1 tenant slot',
      'Basic analytics dashboard',
    ],
    highlighted: false,
    ctaLabel: 'Start Free',
    ctaPath: '/register',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '49',
    period: 'mo',
    description: 'Perfect for small teams taking their first steps with enterprise AI.',
    features: [
      '25 AI modules',
      'Multi-tenant support (up to 5)',
      'Email & chat support',
      'Payment processing (up to $10k/mo)',
      'Real-time analytics',
      'REST API access',
    ],
    highlighted: false,
    ctaLabel: 'Buy Starter',
    ctaPath: '/checkout',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '199',
    period: 'mo',
    description: 'Full AI module access, autonomous payments, and multi-tenant isolation.',
    features: [
      'All 150+ AI modules',
      'Unlimited tenants',
      'Autonomous payment processing',
      'QuantumVault security layer',
      'Priority 24/7 support',
      'White-label capability',
      'Custom integrations',
      'Advanced analytics & exports',
    ],
    highlighted: true,
    ctaLabel: 'Buy Pro',
    ctaPath: '/checkout',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '499',
    period: 'mo',
    description: 'Unlimited scale, dedicated support, white-label, and custom SLAs.',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'Custom SLA (99.99% uptime)',
      'Dedicated account manager',
      'On-premise deployment option',
      'Custom AI model training',
      'SSO / SAML integration',
      'Compliance reporting (SOC2, GDPR)',
    ],
    highlighted: false,
    ctaLabel: 'Buy Enterprise',
    ctaPath: '/checkout',
  },
];

const ANNUAL_DISCOUNT = 0.2;

function applyDiscount(price) {
  if (price === '0') return '0';
  return String(Math.round(Number(price) * (1 - ANNUAL_DISCOUNT)));
}

const FAQ = [
  {
    q: 'Can I upgrade or downgrade my plan at any time?',
    a: 'Yes. Plan changes take effect at the start of your next billing cycle. You can upgrade immediately — the difference is prorated. Downgrades take effect at renewal.',
  },
  {
    q: 'Do you offer a free trial on paid plans?',
    a: 'All paid plans come with a 14-day money-back guarantee. No questions asked.',
  },
  {
    q: 'What counts as a "tenant"?',
    a: 'Each isolated workspace with its own data, users, and configuration is a tenant. The Free plan includes 1; Starter includes 5; Pro and Enterprise are unlimited.',
  },
  {
    q: 'Is there a usage limit on the payment processing?',
    a: 'Starter is capped at $10k/mo to prevent abuse. Pro and Enterprise have no caps — we process at cost with a small platform fee.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Selecting annual billing locks in a 20% discount on your chosen plan. You are billed once per year. Monthly billing is also available.',
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'rgba(13,15,30,0.7)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#e2e8f0',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          textAlign: 'left',
          fontWeight: 500,
        }}
      >
        {item.q}
        <span style={{
          color: '#00d4ff',
          fontSize: 20,
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.2s',
          flexShrink: 0,
          marginLeft: 12,
        }}>+</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p style={{
              padding: '0 1.5rem 1rem',
              color: '#94a3b8',
              fontSize: 14,
              lineHeight: 1.7,
              margin: 0,
            }}>
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const navigate = useNavigate();

  // Live pricing broker — additive overlay so each plan also shows the BTC
  // equivalent against the live BTC/USD rate. Plans without a matching id in
  // the broker fall back to their displayed USD price unchanged.
  const livePricing = useLivePricing();

  const plans = annual
    ? PLANS_MONTHLY.map(p => ({ ...p, price: applyDiscount(p.price), period: 'mo (billed annually)' }))
    : PLANS_MONTHLY;

  const enrichedPlans = plans.map(p => {
    const live = livePricing.byId[p.id];
    if (!live || !Number.isFinite(live.btc)) return p;
    return { ...p, btc: live.btc, sats: live.sats, livePriced: true };
  });

  return (
    <>
      <SEOMeta
        title="Pricing — Simple, Transparent Plans"
        description="Start free and scale to enterprise. 4 transparent plans with no hidden fees. Annual billing saves 20%."
        canonicalPath="/pricing"
      />

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', padding: '4rem 0 3rem' }}
      >
        <div style={{
          display: 'inline-block',
          background: 'rgba(192,132,252,0.1)',
          border: '1px solid rgba(192,132,252,0.3)',
          borderRadius: 20,
          padding: '4px 16px',
          fontSize: 12,
          color: '#c084fc',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.12em',
          marginBottom: '1.25rem',
        }}>
          ✦ PRICING
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 1rem',
        }}>
          Simple, Transparent{' '}
          <span style={{
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Pricing</span>
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 520, margin: '0 auto 2rem' }}>
          Start free. Scale to enterprise. No surprises on your invoice.
        </p>

        {/* Annual toggle */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(13,15,30,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 30,
          padding: '6px 8px 6px 16px',
        }}>
          <span style={{ fontSize: 14, color: annual ? '#94a3b8' : '#e2e8f0' }}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: annual ? 'linear-gradient(90deg,#00d4ff,#c084fc)' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: annual ? 22 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left 0.3s',
            }} />
          </button>
          <span style={{ fontSize: 14, color: annual ? '#00d4ff' : '#94a3b8' }}>
            Annual
            <span style={{
              marginLeft: 6,
              background: 'rgba(0,255,163,0.15)',
              border: '1px solid rgba(0,255,163,0.3)',
              color: '#00ffa3',
              fontSize: 11,
              borderRadius: 8,
              padding: '1px 6px',
              fontFamily: 'var(--font-heading)',
            }}>-20%</span>
          </span>
        </div>
      </motion.section>

      {/* Pricing cards */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '1rem 0 4rem',
        alignItems: 'stretch',
      }}>
        {enrichedPlans.map((plan, i) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </div>

      {/* Live BTC rate strip */}
      {livePricing.btcRate && Number(livePricing.btcRate.rate) > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'center', marginTop: '-2rem', marginBottom: '3rem',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(247,147,26,0.06)',
            border: '1px solid rgba(247,147,26,0.3)',
            borderRadius: 16, padding: '8px 18px',
            fontFamily: 'var(--font-heading)', fontSize: 12,
            color: '#f7931a', letterSpacing: '0.08em',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: livePricing.status === 'live' ? '#00ffa3' : '#f7931a',
              boxShadow: livePricing.status === 'live' ? '0 0 8px #00ffa3' : 'none',
            }} />
            ₿ LIVE · 1 BTC = ${Number(livePricing.btcRate.rate).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            <span style={{ color: '#94a3b8', textTransform: 'lowercase' }}>
              · prices auto-update via /api/pricing/live
            </span>
          </div>
        </div>
      )}

      {/* All plans include */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.12)',
          borderRadius: 20,
          padding: '2.5rem',
          marginBottom: '4rem',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 20,
          fontWeight: 700,
          color: '#00d4ff',
          margin: '0 0 1.5rem',
          textAlign: 'center',
        }}>
          All Plans Include
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {[
            '🔒 SSL & HTTPS encryption',
            '📊 Basic usage analytics',
            '🌍 Global CDN delivery',
            '🔄 99.9% uptime SLA',
            '📧 Email notifications',
            '🛡️ DDoS protection',
            '🗂️ API documentation',
            '⚡ Instant deployment',
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, color: '#cbd5e1',
            }}>
              <span style={{ color: '#00ffa3' }}>✓</span> {item}
            </div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 26,
          fontWeight: 800,
          color: '#e2e8f0',
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          Frequently Asked Questions
        </h2>
        {FAQ.map((item, i) => (
          <FAQItem key={i} item={item} />
        ))}
      </section>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: '4rem' }}
      >
        <p style={{ fontSize: 15, color: '#64748b', marginBottom: '1.25rem' }}>
          Not sure which plan is right? Talk to us.
        </p>
        <button onClick={() => navigate('/about')} className="btn-ghost">
          Contact Sales →
        </button>
      </motion.div>
    </>
  );
}
