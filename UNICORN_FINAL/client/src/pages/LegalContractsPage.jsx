import React, { useState } from 'react';
import axios from 'axios';

export default function LegalContractsPage() {
  const [generated, setGenerated] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const generateContract = async () => {
    const res = await axios.post('/api/legal/generate', {
      type: 'nda',
      params: {
        partyA: 'UNICORN LABS',
        partyB: 'Global Partner Inc.',
        duration: 24,
        purpose: 'Strategic technology collaboration'
      }
    });
    setGenerated(res.data);
  };

  const analyze = async () => {
    const res = await axios.post('/api/legal/analyze', {
      text: 'This agreement includes indemnify obligations, non-compete, and automatic renewal clauses.'
    });
    setAnalysis(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Legal Contract Generator & Analyzer</h1>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={generateContract} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Generate Contract</button>
        <button onClick={analyze} style={{ padding: '10px 14px', border: 0, borderRadius: 12, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Analyze Contract</button>
      </div>
      {[generated, analysis].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
