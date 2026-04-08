import React, { useState } from 'react';
import axios from 'axios';

export default function AIWorkforcePage() {
  const [agent, setAgent] = useState(null);
  const [job, setJob] = useState(null);
  const [matches, setMatches] = useState([]);

  const runDemo = async () => {
    const registered = await axios.post('/api/workforce/agent', {
      name: 'Contract Analyst AI',
      description: 'Analyzes contracts and legal clauses',
      capabilities: ['legal-analysis', 'risk-scoring', 'summarization'],
      pricePerHour: 120,
      skills: ['contracts', 'compliance', 'negotiation']
    });
    setAgent(registered.data);

    const posted = await axios.post('/api/workforce/job', {
      title: 'Review international supplier contract',
      description: 'Need legal risk and pricing recommendations',
      requiredCapabilities: ['legal-analysis', 'risk-scoring'],
      budget: 200,
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      companyId: 'unicorn-enterprise'
    });
    setJob(posted.data);

    const best = await axios.get('/api/workforce/job/' + posted.data.id + '/agents');
    setMatches(best.data || []);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>AI Workforce Marketplace</h1>
      <button onClick={runDemo} style={{ width: 'fit-content', padding: '10px 14px', border: 0, borderRadius: 12, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Run Workforce Demo</button>
      {[agent, job, matches.length ? matches : null].filter(Boolean).map((block, idx) => (
        <pre key={idx} style={{ margin: 0, padding: 16, borderRadius: 14, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.16)', overflowX: 'auto' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}
