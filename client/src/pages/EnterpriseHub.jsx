import React from 'react';
import { Link } from 'react-router-dom';

const cards = [
  { title: 'Aviation Ops', path: '/enterprise/aviation', description: 'Route optimization, predictive maintenance, and dynamic airline pricing.' },
  { title: 'Government AI', path: '/enterprise/government', description: 'Compliance checks, service digitalization, and public policy analysis.' },
  { title: 'Defense Grid', path: '/enterprise/defense', description: 'Quantum encryption, threat intelligence, and critical infrastructure hardening.' },
  { title: 'Telecom Control', path: '/enterprise/telecom', description: '5G optimization, fault prediction, and revenue assurance.' },
  { title: 'Partner Console', path: '/enterprise/partners', description: 'Enterprise partner registration, API access, invoices, and dashboards.' }
];

export default function EnterpriseHub() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Enterprise Suite</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Sector intelligence command center</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 820 }}>Deploy sector-specific AI modules across aviation, public sector, defense, telecom, and strategic partnerships from one luxury control surface.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {cards.map((card) => (
          <Link key={card.path} to={card.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>{card.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.5 }}>{card.description}</div>
              <div style={{ marginTop: 16, color: '#22d3ee', fontWeight: 700 }}>Open module →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
