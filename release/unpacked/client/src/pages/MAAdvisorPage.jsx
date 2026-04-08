import React, { useState } from 'react';
import axios from 'axios';

export default function MAAdvisorPage() {
  const [targets, setTargets] = useState([]);
  const [deal, setDeal] = useState(null);

  const findTargets = async () => {
    const res = await axios.post('/api/ma/targets', {
      industry: 'AI',
      minRevenue: 20000000,
      maxRevenue: 100000000
    });
    setTargets(res.data || []);
  };

  const negotiate = async () => {
    if (!targets.length) return;
    const targetId = targets[0].id;
    const res = await axios.post('/api/ma/negotiate', {
      targetId,
      initialOffer: 45000000,
      maxPrice: 95000000
    });
    setDeal(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Autonomous M&A Advisor</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={findTargets} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Identify Targets</button>
        <button onClick={negotiate} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Negotiate Deal</button>
      </div>
      {[targets.length ? targets : null, deal].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
