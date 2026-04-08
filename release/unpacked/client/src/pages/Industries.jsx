import React from 'react';
import { Link } from 'react-router-dom';

const industries = [
  {
    title: 'Aviation & Mobility',
    path: '/enterprise/aviation',
    accent: '#22d3ee',
    metrics: ['15M estimated route savings', 'predictive fleet maintenance', 'dynamic ticket yield'],
    description: 'Optimize airline routes, maintenance windows, and pricing strategies with aviation-grade AI orchestration.'
  },
  {
    title: 'Government & Public Sector',
    path: '/enterprise/government',
    accent: '#38bdf8',
    metrics: ['GDPR / SOC2 readiness', 'public service digitalization', 'policy impact analysis'],
    description: 'Launch digital public services, verify compliance gaps, and assess policy outcomes from one control panel.'
  },
  {
    title: 'Defense & Critical Infrastructure',
    path: '/enterprise/defense',
    accent: '#f87171',
    metrics: ['quantum-safe encryption', 'threat intelligence layers', 'critical infra hardening'],
    description: 'Secure sensitive operations with post-quantum encryption, threat scoring, and infrastructure defense workflows.'
  },
  {
    title: 'Telecom & 5G Networks',
    path: '/enterprise/telecom',
    accent: '#34d399',
    metrics: ['5G capacity uplift', 'fault prediction', 'revenue assurance'],
    description: 'Improve latency, predict network incidents, and recover missed revenue across modern telecom estates.'
  },
  {
    title: 'Enterprise Partnerships',
    path: '/enterprise/partners',
    accent: '#c084fc',
    metrics: ['partner APIs', 'dashboard access', 'invoice generation'],
    description: 'Activate white-label partnerships, provision API keys, and manage strategic partner contracts end-to-end.'
  }
];

export default function Industries() {
  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Industries</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Luxury AI verticals for strategic sectors</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Choose an industry lane to open specialized enterprise modules, live API demos, and operational dashboards tailored for high-value sectors.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {industries.map((industry) => (
          <Link key={industry.path} to={industry.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ height: '100%', padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
              <div style={{ width: 56, height: 4, borderRadius: 999, background: industry.accent, marginBottom: 18 }} />
              <div style={{ fontSize: 24, fontWeight: 800 }}>{industry.title}</div>
              <div style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.55 }}>{industry.description}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                {industry.metrics.map((metric) => (
                  <div key={metric} style={{ color: '#e2e8f0', fontSize: 14 }}>• {metric}</div>
                ))}
              </div>
              <div style={{ marginTop: 18, color: industry.accent, fontWeight: 700 }}>Open industry module →</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
