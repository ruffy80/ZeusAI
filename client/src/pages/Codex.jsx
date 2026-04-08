import React from 'react';
import { Link } from 'react-router-dom';

const modules = [
  { title: 'Payments Codex', path: '/payments', tag: 'Monetization', description: 'Universal gateway, receipts, BTC pricing, and transaction stats.' },
  { title: 'Marketplace Codex', path: '/marketplace', tag: 'Commerce', description: 'Service discovery, dynamic pricing, recommendations, and checkout.' },
  { title: 'Enterprise Codex', path: '/enterprise', tag: 'Operations', description: 'Industry-grade control surfaces for aviation, defense, government, telecom, and partners.' },
  { title: 'Capabilities Codex', path: '/capabilities', tag: 'Platform', description: 'Overview of strategic capabilities across the full Unicorn stack.' },
  { title: 'Industries Codex', path: '/industries', tag: 'Verticals', description: 'Direct access to specialized sectors and regulated operating environments.' },
  { title: 'Dashboard Codex', path: '/dashboard', tag: 'Analytics', description: 'System-wide visibility across risk, compliance, opportunities, payments, and marketplace metrics.' }
];

export default function Codex() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Codex</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Operational knowledge map of the Unicorn platform</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Use the Codex as a strategic entry point into monetization, enterprise operations, analytics, and platform intelligence modules.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {modules.map((module) => (
          <Link key={module.path} to={module.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ color: '#22d3ee', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.6 }}>{module.tag}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{module.title}</div>
              <div style={{ color: '#cbd5e1', marginTop: 10, lineHeight: 1.55 }}>{module.description}</div>
              <div style={{ marginTop: 16, color: '#a855f7', fontWeight: 700 }}>Open section →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
