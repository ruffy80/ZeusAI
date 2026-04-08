import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function Dashboard({ healthData = [] }) {
  const [stats, setStats] = useState({
    payment: null,
    marketplace: null,
    compliance: null,
    risk: null,
    opportunity: null
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [paymentRes, marketplaceRes, complianceRes, riskRes, opportunityRes] = await Promise.all([
          axios.get('/api/payment/stats'),
          axios.get('/api/marketplace/stats'),
          axios.get('/api/compliance/stats'),
          axios.get('/api/risk/stats'),
          axios.get('/api/opportunity/stats')
        ]);

        setStats({
          payment: paymentRes.data,
          marketplace: marketplaceRes.data,
          compliance: complianceRes.data,
          risk: riskRes.data,
          opportunity: opportunityRes.data
        });
      } catch (err) {
        console.error('Dashboard load failed', err);
      }
    };

    load();
  }, []);

  const analyticsAverage = useMemo(() => {
    if (!healthData.length) return 0;
    return healthData.reduce((sum, value) => sum + value, 0) / healthData.length;
  }, [healthData]);

  const cards = [
    { label: 'Payments', value: stats.payment?.totalPayments || 0, sub: 'Revenue ' + '$' + Number(stats.payment?.revenue || 0).toFixed(2), accent: '#22d3ee' },
    { label: 'Marketplace', value: stats.marketplace?.totalServices || 0, sub: 'Avg price ' + '$' + Number(stats.marketplace?.avgPrice || 0).toFixed(2), accent: '#c084fc' },
    { label: 'Compliance', value: stats.compliance?.complianceScore || 0, sub: 'Score / 100', accent: '#34d399' },
    { label: 'Risk Analyses', value: stats.risk?.totalAnalyses || 0, sub: 'High risk ' + Number(stats.risk?.highRiskCount || 0), accent: '#f87171' },
    { label: 'Opportunities', value: stats.opportunity?.totalOpportunities || 0, sub: 'Unread alerts ' + Number(stats.opportunity?.unreadAlerts || 0), accent: '#f59e0b' },
    { label: 'Live Analytics', value: Number(analyticsAverage).toFixed(1) + '%', sub: healthData.length + ' datapoints', accent: '#38bdf8' }
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Dashboard</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Autonomous system performance overview</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Monitor commercial activity, risk posture, compliance health, and opportunity flow from one executive-grade analytics surface.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
            <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
            <div style={{ color: '#cbd5e1', marginTop: 8 }}>{card.sub}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Signal stream</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8, height: 180 }}>
            {(healthData.length ? healthData : [20, 35, 25, 50, 60, 55, 72]).map((value, index) => (
              <div key={index} style={{ flex: 1, borderRadius: '10px 10px 0 0', background: 'linear-gradient(180deg,#22d3ee,#a855f7)', height: Math.max(16, value * 1.6) }} />
            ))}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>System notes</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: '#e2e8f0' }}>• Payment engine and marketplace are actively connected.</div>
            <div style={{ color: '#e2e8f0' }}>• Opportunity radar updates feed enterprise expansion decisions.</div>
            <div style={{ color: '#e2e8f0' }}>• Compliance and risk stats are surfaced live from generated backend APIs.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
