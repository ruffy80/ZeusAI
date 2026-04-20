import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';

const STEPS = [
  {
    num: '01',
    title: 'Register',
    icon: '📝',
    desc: 'Create your free account in under 60 seconds. No credit card required. Your workspace is provisioned instantly.',
    color: '#00d4ff',
  },
  {
    num: '02',
    title: 'Choose a Service',
    icon: '🛒',
    desc: 'Browse 150+ AI modules in the marketplace. Filter by category, price, or capability. Activate with one click.',
    color: '#c084fc',
  },
  {
    num: '03',
    title: 'Configure',
    icon: '⚙️',
    desc: 'Set your parameters — tenant isolation level, payment rails, data sources, and alerting rules — via a guided UI or API.',
    color: '#00ffa3',
  },
  {
    num: '04',
    title: 'Launch',
    icon: '🚀',
    desc: 'Deploy your AI agent in seconds. ZEUS handles containerisation, scaling, and health monitoring automatically.',
    color: '#f59e0b',
  },
  {
    num: '05',
    title: 'Monitor & Scale',
    icon: '📊',
    desc: 'Watch live metrics on the real-time dashboard. Add more modules, scale tenants, and iterate without downtime.',
    color: '#00d4ff',
  },
];

const DEEP_DIVES = [
  {
    icon: '🧠',
    title: 'AI Orchestration',
    color: '#00d4ff',
    points: [
      'Task graph decomposition — complex goals split into atomic agent tasks.',
      'Automatic retry with exponential backoff on agent failures.',
      'Cross-agent data passing with typed schema validation.',
      'Real-time task progress visible in the dashboard SSE stream.',
    ],
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Isolation',
    color: '#c084fc',
    points: [
      'Separate in-memory namespaces per tenant with hard resource quotas.',
      'Per-tenant JWT signing keys — a breach of one tenant cannot escalate.',
      'Configurable rate limits and feature flags per tenant.',
      'Instant tenant teardown with full data wipe on demand.',
    ],
  },
  {
    icon: '💳',
    title: 'Autonomous Payments',
    color: '#00ffa3',
    points: [
      'Supports cards (Stripe), PayPal, bank transfer, BTC, ETH.',
      'Auto-reconciliation matches invoices to payments within 200ms.',
      'Webhook delivery with automatic retry and idempotency keys.',
      'Revenue analytics dashboard with P&L, cohort, and churn views.',
    ],
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    color: '#f59e0b',
    points: [
      'Server-Sent Events (SSE) stream delivers metrics at sub-second latency.',
      'Anomaly detection flags deviations beyond 2σ from baseline.',
      'Predictive forecasting models trained on your historical data.',
      'Export to CSV, JSON, or webhook for downstream BI tools.',
    ],
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <>
      <SEOMeta
        title="How It Works — ZEUS & AI Unicorn Platform"
        description="Step-by-step walkthrough of the ZEUS & AI platform: register, choose a service, configure, launch, and monitor your autonomous AI agents."
        canonicalPath="/how-it-works"
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
          background: 'rgba(0,255,163,0.1)',
          border: '1px solid rgba(0,255,163,0.3)',
          borderRadius: 20,
          padding: '4px 16px',
          fontSize: 12,
          color: '#00ffa3',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.12em',
          marginBottom: '1.25rem',
        }}>
          ✦ HOW IT WORKS
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 1rem',
        }}>
          From Zero to{' '}
          <span style={{
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Autonomous</span>
          {' '}in Minutes
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 560, margin: '0 auto' }}>
          The ZEUS &amp; AI platform is designed for speed. Most users go from signup to first
          autonomous agent running within 5 minutes.
        </p>
      </motion.section>

      {/* Step-by-step */}
      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          marginBottom: '2rem',
        }}>
          The 5-Step Process
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: 27,
            top: 56,
            bottom: 56,
            width: 2,
            background: 'linear-gradient(180deg, #00d4ff20, #c084fc20)',
            zIndex: 0,
          }} />
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `${step.color}18`,
                border: `2px solid ${step.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-heading)',
                fontSize: 14,
                fontWeight: 800,
                color: step.color,
                flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(13,15,30,0.7)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `3px solid ${step.color}`,
                borderRadius: 16,
                padding: '1.25rem 1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: 22 }}>{step.icon}</span>
                  <h3 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: step.color,
                    margin: 0,
                  }}>{step.title}</h3>
                </div>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Deep dives */}
      <section style={{ marginBottom: '4rem' }}>
        <motion.h2 {...fadeUp} style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          marginBottom: '1.5rem',
        }}>
          Feature Deep Dives
        </motion.h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}>
          {DEEP_DIVES.map((dd, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="card-glow"
              style={{ padding: '1.75rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
                <span style={{ fontSize: 28 }}>{dd.icon}</span>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: dd.color,
                  margin: 0,
                }}>{dd.title}</h3>
              </div>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {dd.points.map((pt, j) => (
                  <li key={j} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '0.45rem 0',
                    borderBottom: j < dd.points.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    fontSize: 14,
                    color: '#94a3b8',
                    lineHeight: 1.5,
                  }}>
                    <span style={{ color: dd.color, fontSize: 14, marginTop: 1, flexShrink: 0 }}>→</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Integration diagram (text/icon) */}
      <motion.section {...fadeUp} style={{
        background: 'rgba(13,15,30,0.8)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '2.5rem',
        marginBottom: '4rem',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          marginBottom: '2rem',
        }}>
          Integration Architecture
        </h2>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Your App', icon: '🖥️', color: '#00d4ff' },
            { label: '→', icon: null, color: '#475569' },
            { label: 'ZEUS API', icon: '⚡', color: '#c084fc' },
            { label: '→', icon: null, color: '#475569' },
            { label: 'AI Agents', icon: '🤖', color: '#00ffa3' },
            { label: '→', icon: null, color: '#475569' },
            { label: 'Data & Payments', icon: '💾', color: '#f59e0b' },
            { label: '→', icon: null, color: '#475569' },
            { label: 'Your Dashboard', icon: '📊', color: '#00d4ff' },
          ].map((node, i) => (
            node.icon ? (
              <div key={i} style={{
                background: `${node.color}12`,
                border: `1px solid ${node.color}30`,
                borderRadius: 12,
                padding: '0.75rem 1.25rem',
                textAlign: 'center',
                minWidth: 100,
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{node.icon}</div>
                <div style={{ fontSize: 12, color: node.color, fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                  {node.label}
                </div>
              </div>
            ) : (
              <div key={i} style={{ fontSize: 20, color: node.color }}>→</div>
            )
          ))}
        </div>
        <p style={{ color: '#475569', fontSize: 13, marginTop: '1.5rem', maxWidth: 520, margin: '1.5rem auto 0' }}>
          Your application communicates with the ZEUS REST API. Agents execute autonomously and
          write results back to your dashboard in real time via SSE.
        </p>
      </motion.section>

      {/* CTA */}
      <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#f0f4ff',
          marginBottom: '1rem',
        }}>
          Ready to get started?
        </h3>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/register')} className="btn-primary" style={{ fontSize: 15, padding: '0.8rem 2rem' }}>
            🚀 Register Free
          </button>
          <button onClick={() => navigate('/services')} className="btn-ghost" style={{ fontSize: 15, padding: '0.78rem 2rem' }}>
            Browse Services
          </button>
        </div>
      </motion.div>
    </>
  );
}
