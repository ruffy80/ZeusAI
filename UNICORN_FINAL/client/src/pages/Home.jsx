import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ZEUS3D from '../components/ZEUS3D';
import SEOMeta from '../components/SEOMeta';
import StatsBar from '../components/StatsBar';
import FeatureGrid from '../components/FeatureGrid';
import TestimonialSlider from '../components/TestimonialSlider';

/* ── Animated particle canvas ─────────────────────────────────── */
function HeroParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = 60;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.5 ? '#00d4ff' : '#c084fc',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  );
}

const STATS = [
  { value: '150', label: 'AI Modules', suffix: '+' },
  { value: '99.9', label: 'Uptime', suffix: '%' },
  { value: '$2M', label: 'Revenue Processed', suffix: '+' },
  { value: '50', label: 'Enterprise Clients', suffix: '+' },
];

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Orchestration',
    description: 'Coordinate 150+ autonomous AI agents across complex workflows with zero manual intervention.',
    color: '#00d4ff',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant SaaS',
    description: 'True tenant isolation with per-client configurations, white-labelling, and dedicated resource pools.',
    color: '#c084fc',
  },
  {
    icon: '💳',
    title: 'Autonomous Payments',
    description: 'Multi-rail payment processing — cards, crypto, bank transfer — fully automated and reconciled.',
    color: '#00ffa3',
  },
  {
    icon: '🔐',
    title: 'Quantum Security',
    description: 'QuantumVault encryption, JWT-based auth, Helmet CSP headers, and real-time threat detection.',
    color: '#f59e0b',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    description: 'Live SSE data streams, predictive dashboards, and AI-powered anomaly detection across all modules.',
    color: '#00d4ff',
  },
  {
    icon: '🦄',
    title: 'White-Label Engine',
    description: 'Fully brandable platform with custom domains, themes, and client-specific feature flags.',
    color: '#c084fc',
  },
];

const SERVICE_PREVIEWS = [
  {
    name: 'AI Revenue Optimizer',
    description: 'ML-driven pricing, upsell timing, and churn prevention across your entire customer base.',
    category: 'Revenue',
    price: '$299/mo',
  },
  {
    name: 'Compliance Sentinel',
    description: 'Automated regulatory compliance monitoring — GDPR, SOC2, ISO 27001 — with real-time alerts.',
    category: 'Security',
    price: '$199/mo',
  },
  {
    name: 'Quantum Deal Analyzer',
    description: 'AI-powered M&A and deal analysis with risk scoring, market mapping, and negotiation support.',
    category: 'Enterprise',
    price: '$499/mo',
  },
];

const PLAN_TEASERS = [
  {
    name: 'Free',
    tagline: 'Explore the platform with core modules and a sandboxed environment.',
    color: '#94a3b8',
  },
  {
    name: 'Pro',
    tagline: 'Full AI module access, autonomous payments, and multi-tenant isolation.',
    color: '#00d4ff',
    popular: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Unlimited scale, dedicated support, white-label, and custom SLAs.',
    color: '#c084fc',
  },
];

const sectionStyle = { padding: '5rem 0' };
const sectionTitleStyle = {
  fontFamily: 'var(--font-heading)',
  fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
  fontWeight: 800,
  background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  margin: '0 0 1rem',
  letterSpacing: '0.04em',
};
const sectionSubStyle = {
  fontSize: 16,
  color: '#94a3b8',
  margin: '0 0 2.5rem',
  maxWidth: 600,
};

export default function Home() {
  const navigate = useNavigate();
  const [zeusCommand, setZeusCommand] = useState('');

  return (
    <>
      <SEOMeta
        title="ZEUS & AI · Unicorn Platform — Autonomous AI for Enterprise"
        description="Deploy autonomous AI agents, manage enterprise operations, and scale revenue — all from one command center."
        canonicalPath="/"
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1.1fr',
        gap: 40,
        alignItems: 'center',
        padding: '4rem 0 6rem',
        overflow: 'hidden',
      }}>
        <HeroParticles />

        {/* Zeus 3D avatar */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            borderRadius: 28,
            overflow: 'hidden',
            border: '1px solid rgba(167,139,250,.22)',
            background: 'rgba(6,6,22,.82)',
            padding: 20,
            boxShadow: '0 0 50px rgba(167,139,250,.12)',
            zIndex: 1,
          }}
        >
          <ZEUS3D onCommand={setZeusCommand} />
          {zeusCommand && (
            <div style={{
              marginTop: 10, textAlign: 'center', color: '#fbbf24', fontSize: 13,
              background: 'rgba(251,191,36,.08)', borderRadius: 8, padding: '6px 14px',
              border: '1px solid rgba(251,191,36,.2)',
            }}>
              ⚡ "{zeusCommand}"
            </div>
          )}
        </motion.div>

        {/* Headline + CTAs */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          style={{ zIndex: 1 }}
        >
          <div style={{
            display: 'inline-block',
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
            color: '#00d4ff',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.12em',
            marginBottom: '1.25rem',
          }}>
            ✦ AUTONOMOUS AI PLATFORM
          </div>

          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            margin: '0 0 1.25rem',
            color: '#f0f4ff',
            letterSpacing: '0.02em',
          }}>
            The AI Platform That{' '}
            <span style={{
              background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Runs Your Business
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: '#94a3b8',
            lineHeight: 1.7,
            marginBottom: '2.5rem',
            maxWidth: 520,
          }}>
            Deploy autonomous AI agents, manage enterprise operations, and scale revenue
            — all from one command center.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/register')}
              className="btn-primary"
              style={{ fontSize: 15, padding: '0.8rem 2rem' }}
            >
              🚀 Get Started Free
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/services')}
              className="btn-ghost"
              style={{ fontSize: 15, padding: '0.78rem 2rem' }}
            >
              Explore Services →
            </motion.button>
          </div>

          <div style={{
            marginTop: '2.5rem',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}>
            {['SOC2 Compliant', 'GDPR Ready', '99.9% SLA'].map(badge => (
              <div key={badge} style={{
                fontSize: 12,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ color: '#00ffa3' }}>✓</span> {badge}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <StatsBar stats={STATS} />
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 style={sectionTitleStyle}>Platform Capabilities</h2>
          <p style={sectionSubStyle}>
            Every module built for enterprise scale — resilient, isolated, and always-on.
          </p>
        </motion.div>
        <FeatureGrid features={FEATURES} />
      </section>

      {/* ── SERVICES PREVIEW ──────────────────────────────────── */}
      <section style={sectionStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: '2rem' }}
        >
          <div>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Featured Services</h2>
            <p style={{ ...sectionSubStyle, margin: '0.5rem 0 0' }}>
              Plug-and-play AI services activated in seconds.
            </p>
          </div>
          <Link
            to="/services"
            style={{ color: '#00d4ff', textDecoration: 'none', fontSize: 14, fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}
          >
            View All Services →
          </Link>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {SERVICE_PREVIEWS.map((svc, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="card-glow"
              style={{ padding: '1.75rem' }}
            >
              <div style={{
                display: 'inline-block',
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: 12,
                padding: '2px 10px',
                fontSize: 11,
                color: '#00d4ff',
                fontFamily: 'var(--font-heading)',
                marginBottom: '0.75rem',
                letterSpacing: '0.08em',
              }}>
                {svc.category}
              </div>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 16,
                fontWeight: 700,
                color: '#e2e8f0',
                margin: '0 0 0.5rem',
              }}>
                {svc.name}
              </h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 1rem' }}>
                {svc.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-heading)', color: '#00ffa3', fontSize: 15, fontWeight: 700 }}>
                  {svc.price}
                </span>
                <button
                  onClick={() => navigate('/services')}
                  style={{
                    background: 'rgba(0,212,255,0.1)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    color: '#00d4ff',
                    borderRadius: 8,
                    padding: '4px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.06em',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; }}
                >
                  Details
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── PRICING TEASER ────────────────────────────────────── */}
      <section style={sectionStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: '2rem' }}
        >
          <div>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Plans for Every Scale</h2>
            <p style={{ ...sectionSubStyle, margin: '0.5rem 0 0' }}>
              Start free. Upgrade as you grow. No lock-in.
            </p>
          </div>
          <Link to="/pricing" style={{ color: '#00d4ff', textDecoration: 'none', fontSize: 14, fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
            See Full Pricing →
          </Link>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {PLAN_TEASERS.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="card-glow"
              style={{
                padding: '1.5rem',
                borderLeft: `3px solid ${plan.color}`,
                position: 'relative',
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
                  color: '#05060e',
                  fontSize: 9,
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                  borderRadius: 8,
                  padding: '2px 8px',
                  letterSpacing: '0.1em',
                }}>POPULAR</div>
              )}
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 20,
                fontWeight: 800,
                color: plan.color,
                marginBottom: '0.5rem',
              }}>{plan.name}</div>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.55, margin: 0 }}>{plan.tagline}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section style={sectionStyle}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '2.5rem' }}
        >
          <h2 style={sectionTitleStyle}>Trusted by Enterprise Teams</h2>
          <p style={{ ...sectionSubStyle, margin: '0 auto' }}>
            Real results from real deployments.
          </p>
        </motion.div>
        <TestimonialSlider />
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          ...sectionStyle,
          background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(192,132,252,0.08))',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 24,
          textAlign: 'center',
          padding: '4rem 2rem',
          margin: '2rem 0',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 1rem',
        }}>
          Start Building with{' '}
          <span style={{
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Unicorn</span>{' '}
          Today
        </h2>
        <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 auto 2.5rem', maxWidth: 480 }}>
          Join 50+ enterprise teams already running on ZEUS & AI. No credit card required.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/register')}
            className="btn-primary"
            style={{ fontSize: 16, padding: '0.85rem 2.25rem' }}
          >
            🚀 Register Free
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/services')}
            className="btn-ghost"
            style={{ fontSize: 16, padding: '0.83rem 2.25rem' }}
          >
            Explore Services
          </motion.button>
        </div>
      </motion.section>
    </>
  );
}

