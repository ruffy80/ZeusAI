import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function UnicornLab() {
  const [trust, setTrust] = useState(null);
  const [plans, setPlans] = useState([]);
  const [roi, setRoi] = useState(null);
  const [copilot, setCopilot] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const token = localStorage.getItem('adminToken') || '';
      const [t, p] = await Promise.all([
        axios.get('/api/trust/status'),
        axios.get('/api/billing/plans', { headers: { 'x-auth-token': token } })
      ]);
      setTrust(t.data);
      setPlans(p.data.plans || []);
    } catch (e) {
      // noop
    }
  };

  const calcRoi = async () => {
    const res = await axios.post('/api/site/roi/calculate', { investment: 10000, expectedGain: 26000 });
    setRoi(res.data);
  };

  const askCopilot = async () => {
    const token = localStorage.getItem('adminToken') || '';
    const res = await axios.post('/api/executive/copilot', { prompt: copilot }, { headers: { 'x-auth-token': token } });
    setCopilotAnswer(res.data.answer || '');
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>🦄 Unicorn Lab</h1>

      <section style={{ marginTop: 18 }}>
        <h2>1) Trust Center</h2>
        <pre>{JSON.stringify(trust, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2>2) Billing plans</h2>
        <ul>{plans.map(p => <li key={p.id}>{p.name} - ${p.priceMonthly}/lună</li>)}</ul>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2>6) Executive Copilot</h2>
        <input value={copilot} onChange={(e) => setCopilot(e.target.value)} placeholder="Întrebare pentru copilot" style={{ width: 420, marginRight: 8 }} />
        <button onClick={askCopilot}>Ask</button>
        {copilotAnswer && <p><b>Răspuns:</b> {copilotAnswer}</p>}
      </section>

      <section style={{ marginTop: 18 }}>
        <h2>9) ROI Calculator</h2>
        <button onClick={calcRoi}>Calculează ROI demo</button>
        <pre>{JSON.stringify(roi, null, 2)}</pre>
      </section>

      <p style={{ marginTop: 18, opacity: 0.8 }}>
        Restul inovațiilor sunt active prin API: API Keys/Webhooks, A/B Experiments, Security, Onboarding, Affiliate.
      </p>
    </div>
  );
}
