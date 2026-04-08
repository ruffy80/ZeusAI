import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function InnovationCommandCenter() {
  const [stats, setStats] = useState({
    blockchain: null,
    workforce: null,
    ma: null,
    legal: null,
    energy: null
  });

  const load = async () => {
    try {
      const [blockchain, workforce, ma, legal, energy] = await Promise.all([
        axios.get('/api/blockchain/stats'),
        axios.get('/api/workforce/stats'),
        axios.get('/api/ma/stats'),
        axios.get('/api/legal/stats'),
        axios.get('/api/energy/stats')
      ]);

      setStats({
        blockchain: blockchain.data,
        workforce: workforce.data,
        ma: ma.data,
        legal: legal.data,
        energy: energy.data
      });
    } catch (err) {
      console.error('Innovation command center load failed', err);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, []);

  const cards = [
    { title: 'Quantum Blockchain', path: '/innovation/blockchain', accent: '#22d3ee', value: stats.blockchain ? stats.blockchain.chainLength + ' blocks' : '...' },
    { title: 'AI Workforce', path: '/innovation/workforce', accent: '#a855f7', value: stats.workforce ? stats.workforce.totalAgents + ' agents' : '...' },
    { title: 'M&A Advisor', path: '/innovation/ma', accent: '#38bdf8', value: stats.ma ? stats.ma.totalDeals + ' deals' : '...' },
    { title: 'Legal Engine', path: '/innovation/legal', accent: '#f59e0b', value: stats.legal ? stats.legal.totalAnalyzed + ' analyses' : '...' },
    { title: 'Energy Grid', path: '/innovation/energy', accent: '#22c55e', value: stats.energy ? stats.energy.totalCapacity + ' MW capacity' : '...' }
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Innovation Command Center</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Unified strategic innovation cockpit</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 840 }}>Monitor all five strategic innovations from one executive dashboard and jump into detailed module operations in one click.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <Link key={card.path} to={card.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
              <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.title}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
              <div style={{ marginTop: 10, color: card.accent, fontWeight: 700 }}>Open module →</div>
            </div>
          </Link>
        ))}
      </section>

      <section style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
        <h2 style={{ marginTop: 0 }}>Raw live payload</h2>
        <pre style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(2,6,23,.45)', border: '1px solid rgba(148,163,184,.14)', overflowX: 'auto' }}>{JSON.stringify(stats, null, 2)}</pre>
      </section>
    </div>
  );
}
