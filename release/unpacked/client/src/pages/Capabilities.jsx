import React from 'react';
import { Link } from 'react-router-dom';

const capabilities = [
  {
    title: 'Marketplace Intelligence',
    path: '/marketplace',
    accent: '#22d3ee',
    bullets: ['dynamic service pricing', 'personalized recommendations', 'AI service catalog'],
    description: 'Activate productized AI services with adaptive pricing, demand tracking, and premium checkout flows.'
  },
  {
    title: 'Universal Payments',
    path: '/payments',
    accent: '#c084fc',
    bullets: ['multi-method checkout', 'crypto QR flows', 'receipt and revenue dashboards'],
    description: 'Process premium payments, track receipts, and manage payment operations from a unified control center.'
  },
  {
    title: 'Enterprise Industries',
    path: '/industries',
    accent: '#38bdf8',
    bullets: ['aviation operations', 'government compliance', 'telecom optimization'],
    description: 'Navigate sector-specific AI programs across regulated and high-scale enterprise industries.'
  },
  {
    title: 'Strategic Partnerships',
    path: '/enterprise/partners',
    accent: '#f59e0b',
    bullets: ['partner onboarding', 'API key access', 'invoice automation'],
    description: 'Launch partner ecosystems with contract templates, authenticated APIs, and enterprise billing views.'
  },
  {
    title: 'Defense & Security',
    path: '/enterprise/defense',
    accent: '#f87171',
    bullets: ['quantum encryption', 'threat intelligence', 'critical infrastructure scoring'],
    description: 'Operate security-grade modules for encryption, intelligence assessment, and infrastructure resilience.'
  },
  {
    title: 'Aviation & Telecom Ops',
    path: '/enterprise',
    accent: '#34d399',
    bullets: ['route optimization', '5G performance tuning', 'predictive maintenance'],
    description: 'Coordinate mobility, fleet, and network orchestration from the enterprise operations suite.'
  }
];

export default function Capabilities() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Capabilities</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Full-stack AI execution capabilities</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Explore the platform’s strongest commercial, operational, and enterprise capabilities through linked control surfaces already wired into the Unicorn stack.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {capabilities.map((capability) => (
          <Link key={capability.path} to={capability.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ width: 56, height: 4, borderRadius: 999, background: capability.accent, marginBottom: 18 }} />
              <div style={{ fontSize: 24, fontWeight: 800 }}>{capability.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.55 }}>{capability.description}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                {capability.bullets.map((bullet) => (
                  <div key={bullet} style={{ color: '#e2e8f0', fontSize: 14 }}>• {bullet}</div>
                ))}
              </div>
              <div style={{ marginTop: 18, color: capability.accent, fontWeight: 700 }}>Open capability →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
