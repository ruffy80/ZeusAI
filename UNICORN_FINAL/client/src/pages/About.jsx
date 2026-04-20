import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';

const TECH_STACK = [
  { name: 'Node.js', role: 'Backend runtime', color: '#68d391' },
  { name: 'React 18', role: 'Frontend framework', color: '#61dafb' },
  { name: 'Express', role: 'API layer', color: '#94a3b8' },
  { name: 'Tailwind CSS', role: 'UI styling', color: '#38bdf8' },
  { name: 'Framer Motion', role: 'Animations', color: '#c084fc' },
  { name: 'JWT', role: 'Authentication', color: '#f59e0b' },
  { name: 'Helmet CSP', role: 'Security headers', color: '#f87171' },
  { name: 'QuantumVault', role: 'Encryption layer', color: '#00d4ff' },
];

const CAPABILITIES = [
  { icon: '🧠', title: 'AI Orchestration Engine', desc: 'Coordinate 150+ autonomous agents across any workflow with intelligent task delegation and retry logic.' },
  { icon: '🏢', title: 'Multi-Tenant SaaS Core', desc: 'True per-tenant data isolation, resource quotas, and white-label branding from a single deployment.' },
  { icon: '💳', title: 'Autonomous Payment Rails', desc: 'Multi-currency, multi-method payment processing with automatic reconciliation and fraud prevention.' },
  { icon: '📊', title: 'Real-time Analytics', desc: 'Live SSE data streams feeding predictive dashboards with AI-powered anomaly detection.' },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function About() {
  const navigate = useNavigate();

  return (
    <>
      <SEOMeta
        title="About ZEUS & AI — Mission & Team"
        description="Learn about the ZEUS & AI Unicorn Platform — our mission, technology, security posture, and the team building autonomous enterprise AI."
        canonicalPath="/about"
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
          ✦ ABOUT US
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 1rem',
        }}>
          Building the{' '}
          <span style={{
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Future of Enterprise AI</span>
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 580, margin: '0 auto' }}>
          ZEUS & AI is a sovereign-grade autonomous platform designed to run every critical
          business function — from revenue to compliance — without human bottlenecks.
        </p>
      </motion.section>

      {/* Mission */}
      <motion.section {...fadeUp} style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(192,132,252,0.06))',
        border: '1px solid rgba(0,212,255,0.12)',
        borderRadius: 20,
        padding: '2.5rem',
        marginBottom: '3rem',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#00d4ff',
          margin: '0 0 1rem',
          letterSpacing: '0.04em',
        }}>
          Our Mission
        </h2>
        <p style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.8, margin: 0, maxWidth: 720 }}>
          We believe that every enterprise — regardless of size — deserves access to the same calibre
          of AI infrastructure that powers the world's largest organisations. ZEUS & AI packages
          150+ battle-tested AI modules into a single, self-sovereign platform that teams can
          deploy in minutes and trust with their most critical operations.
        </p>
      </motion.section>

      {/* Capabilities */}
      <motion.section {...fadeUp} style={{ marginBottom: '3rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          margin: '0 0 1.5rem',
        }}>
          Platform Capabilities
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}>
          {CAPABILITIES.map((cap, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="card-glow"
              style={{ padding: '1.5rem' }}
            >
              <div style={{ fontSize: 28, marginBottom: '0.75rem' }}>{cap.icon}</div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 15,
                fontWeight: 700,
                color: '#00d4ff',
                margin: '0 0 0.5rem',
              }}>{cap.title}</h3>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Owner / Operator */}
      <motion.section {...fadeUp} style={{
        background: 'rgba(13,15,30,0.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '2.5rem',
        marginBottom: '3rem',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          margin: '0 0 1.5rem',
        }}>
          Owner & Operator
        </h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg,#00d4ff,#c084fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
          }}>👤</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 22,
              fontWeight: 800,
              color: '#00d4ff',
              marginBottom: 4,
            }}>Vladoi Ionut</div>
            <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: '1rem' }}>
              Founder & CEO · ZEUS & AI Unicorn Platform
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 14, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#00ffa3' }}>₿</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: '#94a3b8', letterSpacing: '0.04em' }}>
                  BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                Languages: English · Romanian
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Technology Stack */}
      <motion.section {...fadeUp} style={{ marginBottom: '3rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#e2e8f0',
          margin: '0 0 1.5rem',
        }}>
          Technology Stack
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}>
          {TECH_STACK.map((tech, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              style={{
                background: 'rgba(13,15,30,0.7)',
                border: `1px solid ${tech.color}30`,
                borderRadius: 12,
                padding: '1rem',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 14,
                fontWeight: 700,
                color: tech.color,
                marginBottom: 4,
              }}>{tech.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{tech.role}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Security & Compliance */}
      <motion.section {...fadeUp} style={{
        background: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 20,
        padding: '2.5rem',
        marginBottom: '3rem',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 22,
          fontWeight: 800,
          color: '#f87171',
          margin: '0 0 1rem',
        }}>
          🔐 Security & Compliance
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {[
            { title: 'Helmet CSP', desc: 'Content Security Policy headers enforced on every response via Helmet middleware.' },
            { title: 'JWT Authentication', desc: 'Stateless, signed tokens with configurable expiry and refresh rotation.' },
            { title: 'QuantumVault Encryption', desc: 'AES-256-GCM data-at-rest encryption with per-tenant key derivation.' },
            { title: 'Zero-Trust Network', desc: 'Every service-to-service call requires a valid token. No implicit trust.' },
            { title: 'GDPR Compliant', desc: 'Data residency controls, right-to-erasure API, and consent management built-in.' },
            { title: 'Rate Limiting & DDoS', desc: 'Per-IP and per-tenant rate limits with automatic IP blocking on abuse patterns.' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <span style={{ color: '#00ffa3', fontSize: 16, marginTop: 2, flexShrink: 0 }}>✓</span>
              <div>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#e2e8f0',
                  marginBottom: 2,
                }}>{item.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <button onClick={() => navigate('/register')} className="btn-primary" style={{ fontSize: 15, padding: '0.8rem 2rem' }}>
          🚀 Start Building
        </button>
        <div style={{ marginTop: '1rem', fontSize: 13, color: '#475569' }}>
          Questions? Reach us at BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
        </div>
      </motion.div>
    </>
  );
}
