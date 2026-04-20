import React from 'react';
import { motion } from 'framer-motion';

export default function FeatureGrid({ features = [] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1.25rem',
    }}>
      {features.map((feature, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          style={{
            background: 'rgba(13,15,30,0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderLeft: `3px solid ${feature.color || 'var(--color-primary)'}`,
            borderRadius: 16,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            transition: 'box-shadow 0.25s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = `0 0 24px ${feature.color || 'rgba(0,212,255,0.2)'}40`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: 32 }}>{feature.icon}</div>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 15,
            fontWeight: 700,
            color: feature.color || '#00d4ff',
            margin: 0,
            letterSpacing: '0.04em',
          }}>
            {feature.title}
          </h3>
          <p style={{
            fontSize: 14,
            color: '#94a3b8',
            margin: 0,
            lineHeight: 1.6,
          }}>
            {feature.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
