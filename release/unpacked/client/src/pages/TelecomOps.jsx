import React, { useState } from 'react';
import axios from 'axios';

export default function TelecomOps() {
  const [network, setNetwork] = useState(null);
  const [failures, setFailures] = useState(null);
  const [revenue, setRevenue] = useState(null);

  const runTelecomSuite = async () => {
    const [net, fail, rev] = await Promise.all([
      axios.post('/api/telecom/optimize-5g', { networkId: '5g-eu-core', traffic: { peakLoad: 0.88 } }),
      axios.post('/api/telecom/predict-failures', { nodes: [{ id: 'edge-01', temperature: 83, packetLoss: 0.01 }, { id: 'edge-11', temperature: 64, packetLoss: 0.08 }] }),
      axios.post('/api/telecom/revenue-assurance', { cdrData: [{ subscriberId: 'sub-01', billedAmount: 54, expectedAmount: 74.5 }, { subscriberId: 'sub-77', billedAmount: 30, expectedAmount: 30 }] })
    ]);
    setNetwork(net.data);
    setFailures(fail.data);
    setRevenue(rev.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Telecom Control</h1>
      <button onClick={runTelecomSuite} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Telecom Suite</button>
      {[network, failures, revenue].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
