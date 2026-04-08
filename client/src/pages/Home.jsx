import React from 'react';
import { Link } from 'react-router-dom';
import HolographicCard from '../components/HolographicCard';
import NeonPulseButton from '../components/NeonPulseButton';

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
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 20, alignItems: 'stretch' }}>
        <HolographicCard className="p-8" glowColor="#22d3ee">
          <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Unicorn Autonomous Platform</div>
          <h1 style={{ margin: '10px 0 12px', fontSize: 54, lineHeight: 1.05 }}>Luxury AI infrastructure for commerce, enterprise, and sovereign-scale operations.</h1>
          <p style={{ color: '#cbd5e1', fontSize: 18, lineHeight: 1.6, maxWidth: 760 }}>Operate premium payments, intelligent marketplaces, enterprise verticals, and strategic partner APIs from one high-signal command surface generated end-to-end.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <Link to="/enterprise" style={{ textDecoration: 'none' }}><NeonPulseButton>Launch Enterprise Suite</NeonPulseButton></Link>
            <Link to="/payments" style={{ textDecoration: 'none' }}><NeonPulseButton color="#a855f7">Open Payments</NeonPulseButton></Link>
            <Link to="/marketplace" style={{ textDecoration: 'none' }}><NeonPulseButton color="#22c55e">Browse Marketplace</NeonPulseButton></Link>
          </div>
        </HolographicCard>

        <div style={{ display: 'grid', gap: 16 }}>
          {highlights.map((item) => (
            <div key={item.label} style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.62)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>{item.value}</div>
              <div style={{ color: '#cbd5e1', marginTop: 8 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {quickLinks.map((link) => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{link.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 10, lineHeight: 1.55 }}>{link.description}</div>
              <div style={{ marginTop: 16, color: '#22d3ee', fontWeight: 700 }}>Go now →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
