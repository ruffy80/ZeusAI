import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HolographicCard from '../components/HolographicCard';
import NeonPulseButton from '../components/NeonPulseButton';
import ZEUS3D from '../components/ZEUS3D';

const highlights = [
  { label: 'Enterprise Verticals', value: '5', sub: 'aviation, government, defense, telecom, partnerships' },
  { label: 'Payment Rails', value: '6', sub: 'cards, PayPal, Stripe, BTC, ETH, bank transfer' },
  { label: 'AI Modules', value: '15+', sub: 'risk, compliance, opportunity, marketplace, negotiation, carbon' }
];

const quickLinks = [
  { title: 'Open Marketplace', path: '/marketplace', description: 'Buy and activate premium AI services instantly.' },
  { title: 'View Payments', path: '/payments', description: 'Track receipts, revenue, and treasury flows.' },
  { title: 'Explore Enterprise', path: '/enterprise', description: 'Launch vertical AI operations and partner integrations.' }
];

export default function Home() {
  const [zeusCommand, setZeusCommand] = useState('');

  return (
    <div style={{ display: 'grid', gap: 26 }}>

      {/* ── Hero: Zeus 3D + Platform pitch ─────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'center' }}>

        {/* Zeus 3D avatar panel */}
        <div style={{ borderRadius: 28, overflow: 'hidden', border: '1px solid rgba(167,139,250,.22)',
          background: 'rgba(6,6,22,.82)', padding: 20,
          boxShadow: '0 0 50px rgba(167,139,250,.12), 0 0 2px rgba(212,175,0,.3)' }}>
          <ZEUS3D onCommand={setZeusCommand} />
          {zeusCommand && (
            <div style={{ marginTop: 10, textAlign: 'center', color: '#fbbf24', fontSize: 13,
              background: 'rgba(251,191,36,.08)', borderRadius: 8, padding: '6px 14px',
              border: '1px solid rgba(251,191,36,.2)' }}>
              ⚡ "{zeusCommand}"
            </div>
          )}
        </div>

        {/* Platform pitch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <HolographicCard className="p-8" glowColor="#a855f7">
            <div style={{ color: '#a855f7', textTransform: 'uppercase', letterSpacing: 3, fontSize: 12 }}>
              Unicorn Autonomous Platform
            </div>
            <h1 style={{ margin: '12px 0 14px', fontSize: 42, lineHeight: 1.1 }}>
              Luxury AI infrastructure for commerce, enterprise, and sovereign-scale operations.
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.65 }}>
              Operate premium payments, intelligent marketplaces, enterprise verticals, and strategic partner APIs from one high-signal command surface — powered by Zeus AI.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
              <Link to="/enterprise" style={{ textDecoration: 'none' }}>
                <NeonPulseButton>Launch Enterprise Suite</NeonPulseButton>
              </Link>
              <Link to="/payments" style={{ textDecoration: 'none' }}>
                <NeonPulseButton color="#a855f7">Open Payments</NeonPulseButton>
              </Link>
              <Link to="/marketplace" style={{ textDecoration: 'none' }}>
                <NeonPulseButton color="#22c55e">Browse Marketplace</NeonPulseButton>
              </Link>
            </div>
          </HolographicCard>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {highlights.map((item) => (
              <div key={item.label} style={{ padding: 18, borderRadius: 20,
                background: 'rgba(15,23,42,.62)', border: '1px solid rgba(148,163,184,.16)' }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{item.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6,
                  background: 'linear-gradient(90deg,#d4af37,#a855f7)',
                  WebkitBackgroundClip: 'text', color: 'transparent' }}>{item.value}</div>
                <div style={{ color: '#94a3b8', marginTop: 6, fontSize: 12 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {quickLinks.map((link) => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24,
              background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)',
              transition: 'border-color .2s', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{link.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 10, lineHeight: 1.55 }}>{link.description}</div>
              <div style={{ marginTop: 16, color: '#22d3ee', fontWeight: 700 }}>Go now →</div>
            </div>
          </Link>
        ))}
      </section>

    </div>
  );
}
