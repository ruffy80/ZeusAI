import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote:
      'ZEUS & AI transformed our enterprise operations overnight. The autonomous agents handle what used to require a team of 12 analysts. Revenue attribution accuracy went from 71% to 99.4%.',
    author: 'Alexandra Chen',
    role: 'Chief Technology Officer',
    company: 'NovaTech Global',
  },
  {
    quote:
      "The multi-tenant architecture is flawless. We spun up 40 white-label instances for our portfolio companies in under a week. The isolation, security, and performance are at a level we've never seen from any vendor.",
    author: 'Marcus Reinholt',
    role: 'VP of Platform Engineering',
    company: 'Apex Ventures',
  },
  {
    quote:
      'Autonomous payment processing through ZEUS eliminated our accounts-receivable backlog entirely. $2M in reconciled invoices in the first 30 days. The ROI was immediate.',
    author: 'Priya Nair',
    role: 'CFO',
    company: 'Stellar Finance Group',
  },
  {
    quote:
      'We evaluated six enterprise AI platforms. ZEUS won on every dimension: speed, security, customizability, and support. The QuantumVault encryption layer alone sold our CISO.',
    author: 'Daniel Ferreira',
    role: 'Director of AI Strategy',
    company: 'Meridian Consulting',
  },
  {
    quote:
      "Real-time analytics across 200+ data sources with zero-latency SSE streams. Our ops team now responds to incidents before customers notice them. That's a capability we could never build in-house.",
    author: 'Sophie Laurent',
    role: 'Head of Operations',
    company: 'CloudStream EMEA',
  },
];

export default function TestimonialSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIndex(i => (i + 1) % TESTIMONIALS.length), []);
  const prev = useCallback(() => setIndex(i => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length), []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next]);

  const t = TESTIMONIALS[index];

  return (
    <div
      style={{ position: 'relative', maxWidth: 780, margin: '0 auto' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{
            background: 'rgba(13,15,30,0.8)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,212,255,0.18)',
            borderRadius: 20,
            padding: '2.5rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, color: '#00d4ff', marginBottom: '1.25rem', opacity: 0.6 }}>"</div>
          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: '#cbd5e1',
            lineHeight: 1.8,
            fontStyle: 'italic',
            margin: '0 0 2rem',
          }}>
            {t.quote}
          </p>
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 15,
              fontWeight: 700,
              color: '#00d4ff',
            }}>
              {t.author}
            </div>
            <div style={{ fontSize: 13, color: '#c084fc', marginTop: 4 }}>
              {t.role} · {t.company}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '1.25rem' }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: i === index
                ? 'linear-gradient(90deg,#00d4ff,#c084fc)'
                : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Prev / Next */}
      <button
        onClick={prev}
        style={{
          position: 'absolute', top: '50%', left: -20,
          transform: 'translateY(-50%)',
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.3)',
          color: '#00d4ff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; }}
      >‹</button>
      <button
        onClick={next}
        style={{
          position: 'absolute', top: '50%', right: -20,
          transform: 'translateY(-50%)',
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.3)',
          color: '#00d4ff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; }}
      >›</button>
    </div>
  );
}
