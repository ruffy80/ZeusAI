import React, { useState } from 'react';
import axios from 'axios';

export default function EnergyGridPage() {
  const [producer, setProducer] = useState(null);
  const [consumer, setConsumer] = useState(null);
  const [flow, setFlow] = useState(null);
  const [trades, setTrades] = useState(null);

  const setupDemo = async () => {
    const [p, c] = await Promise.all([
      axios.post('/api/energy/producer', { name: 'Solar Plant A', capacity: 300, type: 'solar', location: 'RO', pricePerMWh: 58 }),
      axios.post('/api/energy/consumer', { name: 'Data Center 1', demand: 180, location: 'RO', maxPrice: 92 })
    ]);
    setProducer(p.data);
    setConsumer(c.data);
  };

  const optimize = async () => {
    const res = await axios.post('/api/energy/optimize');
    setFlow(res.data);
  };

  const trade = async () => {
    const res = await axios.post('/api/energy/trade');
    setTrades(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Decentralized Energy Grid Optimizer</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={setupDemo} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Register Producer + Consumer</button>
        <button onClick={optimize} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Optimize Flow</button>
        <button onClick={trade} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Trade Excess</button>
      </div>
      {[producer, consumer, flow, trades].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
