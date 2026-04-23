import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function PricingCard({ plan = {} }) {
  const {
    name = 'Plan',
    price = '0',
    period = 'mo',
    description = '',
    features = [],
    highlighted = false,
    ctaLabel = 'Get Started',
    ctaPath = '/register',
  } = plan;

  const navigate = useNavigate();

  const handleCta = () => {
    if (ctaPath === '/checkout') {
      navigate(ctaPath, {
        state: {
          plan: {
            id: plan.id || name.toLowerCase(),
            name,
            description,
            price: Number(price),
            tier: name,
          },
        },
      });
    } else {
      navigate(ctaPath);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: highlighted ? '2px' : 0,
        background: highlighted
          ? 'linear-gradient(135deg, #00d4ff, #c084fc)'
          : 'transparent',
        flex: '1 1 280px',
        maxWidth: 340,
      }}
    >
      {highlighted && (
        <div style={{
          position: 'absolute',
          top: -14,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
          color: '#05060e',
          fontFamily: 'var(--font-heading)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '4px 16px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}>
          ★ MOST POPULAR
        </div>
      )}

      <div style={{
        background: highlighted ? '#0d0f1e' : 'rgba(13,15,30,0.85)',
        border: highlighted ? 'none' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: highlighted ? 18 : 20,
        padding: '2rem 1.75rem',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(16px)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 18,
            fontWeight: 700,
            color: highlighted ? '#00d4ff' : '#e2e8f0',
            margin: '0 0 0.5rem',
            letterSpacing: '0.08em',
          }}>
            {name}
          </h3>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>{description}</p>
        </div>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: '1.5rem' }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 42,
            fontWeight: 900,
            color: highlighted ? '#00d4ff' : '#e2e8f0',
            lineHeight: 1,
          }}>
            ${price}
          </span>
          {price !== '0' && (
            <span style={{ color: '#64748b', fontSize: 14, marginBottom: 6 }}>/{period}</span>
          )}
          {price === '0' && (
            <span style={{ color: '#64748b', fontSize: 14, marginBottom: 6 }}>free forever</span>
          )}
        </div>

        {/* Features */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', flex: 1 }}>
          {features.map((f, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '0.45rem 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: 14,
              color: '#cbd5e1',
            }}>
              <span style={{
                color: highlighted ? '#00d4ff' : '#00ffa3',
                fontSize: 16,
                lineHeight: 1.4,
                flexShrink: 0,
              }}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleCta}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.08em',
            transition: 'filter 0.15s ease, transform 0.15s ease',
            background: highlighted
              ? 'linear-gradient(135deg,#00d4ff,#c084fc)'
              : 'rgba(255,255,255,0.06)',
            color: highlighted ? '#05060e' : '#e2e8f0',
            border: highlighted ? 'none' : '1px solid rgba(255,255,255,0.12)',
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}
