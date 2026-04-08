import React, { useState } from 'react';
import axios from 'axios';

export default function DefenseOps() {
  const [encryption, setEncryption] = useState(null);
  const [threats, setThreats] = useState(null);
  const [security, setSecurity] = useState(null);

  const runDefenseSuite = async () => {
    const [enc, thr, sec] = await Promise.all([
      axios.post('/api/defense/encrypt', { message: 'Top secret operational directive', recipient: 'alpha-unit' }),
      axios.post('/api/defense/threats', { sources: ['dark_web', 'signals'], criticalSignals: 4 }),
      axios.post('/api/defense/secure-infrastructure', { infraId: 'grid-sector-7', params: { openFindings: 5 } })
    ]);
    setEncryption(enc.data);
    setThreats(thr.data);
    setSecurity(sec.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Defense Grid</h1>
      <button onClick={runDefenseSuite} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#ef4444', color: '#fff', fontWeight: 700 }}>Run Defense Suite</button>
      {[encryption, threats, security].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
