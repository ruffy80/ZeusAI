import React, { useState } from 'react';
import axios from 'axios';

export default function QuantumBlockchainPage() {
  const [stats, setStats] = useState(null);
  const [tx] = useState({ from: 'treasury', to: 'partner-alpha', amount: 25 });
  const [lastTx, setLastTx] = useState(null);
  const [minedBlock, setMinedBlock] = useState(null);

  const loadStats = async () => {
    const res = await axios.get('/api/blockchain/stats');
    setStats(res.data);
  };

  const addTx = async () => {
    const res = await axios.post('/api/blockchain/transaction', tx);
    setLastTx(res.data);
    await loadStats();
  };

  const mine = async () => {
    const res = await axios.post('/api/blockchain/mine');
    setMinedBlock(res.data);
    await loadStats();
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Quantum Blockchain</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={loadStats} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Load Stats</button>
        <button onClick={addTx} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Add Transaction</button>
        <button onClick={mine} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Mine Block</button>
      </div>
      {[stats, lastTx, minedBlock].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
