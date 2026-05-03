import React, { useState } from 'react';
import axios from 'axios';

export default function GovernmentOps() {
  const [compliance, setCompliance] = useState(null);
  const [digitalization, setDigitalization] = useState(null);
  const [policy, setPolicy] = useState(null);

  const runChecks = async () => {
    const [comp, digi, pol] = await Promise.all([
      axios.post('/api/government/compliance', { agency: 'EU Digital Office', requirements: ['gdpr', 'soc2', 'fedramp'] }),
      axios.post('/api/government/digitalize-service', { serviceId: 'tax-filing', params: { complexity: 'medium' } }),
      axios.post('/api/government/analyze-policy', { policyText: 'Healthcare and education modernization with digital identity and budget reform.' })
    ]);
    setCompliance(comp.data);
    setDigitalization(digi.data);
    setPolicy(pol.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Government AI</h1>
      <button onClick={runChecks} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Government Suite</button>
      {[compliance, digitalization, policy].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
