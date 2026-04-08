import React, { useState, useEffect } from 'react';

// AdminBD – Admin panel for Business Development Engine
const AdminBD = () => {
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('deals');
  const [form, setForm] = useState({ company: '', contact: '', value: '', stage: 'prospecting', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    Promise.all([
      fetch('/api/bd/deals', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/bd/leads', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ]).then(([d, l]) => {
      setDeals(Array.isArray(d) ? d : SAMPLE_DEALS);
      setLeads(Array.isArray(l) ? l : SAMPLE_LEADS);
      setLoading(false);
    });
  }, []);

  const SAMPLE_DEALS = [
    { id: 1, company: 'TechCorp SA', contact: 'Ion Popescu', value: 45000, stage: 'negotiation', probability: 75 },
    { id: 2, company: 'FinanceGroup', contact: 'Maria Ionescu', value: 120000, stage: 'proposal', probability: 50 },
    { id: 3, company: 'MedTech EU', contact: 'Andrei Dima', value: 28000, stage: 'prospecting', probability: 20 },
  ];

  const SAMPLE_LEADS = [
    { id: 1, name: 'StartupX', email: 'ceo@startupx.ro', source: 'LinkedIn', score: 88, status: 'hot' },
    { id: 2, name: 'AgriTech SRL', email: 'contact@agritech.ro', source: 'Referral', score: 65, status: 'warm' },
    { id: 3, name: 'GovDigital', email: 'it@gov.ro', source: 'Website', score: 42, status: 'cold' },
  ];

  const STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
  const STAGE_COLORS = {
    'prospecting': '#64748b', 'qualification': '#3b82f6', 'proposal': '#f59e0b',
    'negotiation': '#a78bfa', 'closed-won': '#22c55e', 'closed-lost': '#ef4444',
  };

  const addDeal = async () => {
    setSaving(true);
    const token = localStorage.getItem('adminToken');
    const deal = { ...form, value: parseFloat(form.value) || 0, id: Date.now() };
    try {
      const r = await fetch('/api/bd/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(deal),
      });
      const d = await r.json();
      setDeals(prev => [...prev, d.deal || deal]);
      setMsg('✅ Deal adăugat!');
    } catch {
      setDeals(prev => [...prev, deal]);
      setMsg('✅ Deal adăugat (local).');
    }
    setForm({ company: '', contact: '', value: '', stage: 'prospecting', notes: '' });
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const pipeline = STAGES.map(s => ({
    stage: s,
    deals: deals.filter(d => d.stage === s),
    total: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0),
  }));

  return (
    <div style={{ minHeight: '100vh', padding: '80px 24px 40px', background: 'radial-gradient(ellipse at 80% 0%, #0a1a3a, #050010)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6,
          background: 'linear-gradient(135deg, #3b82f6, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🤝 Admin Business Development
        </h1>
        <p style={{ color: '#64748b', marginBottom: 32, fontSize: 14 }}>
          Gestionează pipeline-ul de vânzări, lead-uri și oportunități.
        </p>

        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Pipeline', value: `$${deals.reduce((a, d) => a + (d.value || 0), 0).toLocaleString()}`, color: '#a78bfa' },
            { label: 'Deals Active', value: deals.filter(d => !d.stage?.includes('closed')).length, color: '#3b82f6' },
            { label: 'Leads Totale', value: leads.length, color: '#fbbf24' },
            { label: 'Won', value: `$${deals.filter(d => d.stage === 'closed-won').reduce((a, d) => a + (d.value || 0), 0).toLocaleString()}`, color: '#22c55e' },
          ].map(c => (
            <div key={c.label} style={{
              flex: '1 1 180px', background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${c.color}44`, borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>{c.label}</div>
              <div style={{ color: c.color, fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['deals', 'pipeline', 'leads', 'add'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                background: activeTab === t ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeTab === t ? '#7c3aed' : '#7c3aed33'}`,
                color: activeTab === t ? '#a78bfa' : '#64748b',
                borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                textTransform: 'capitalize',
              }}>
              {t === 'deals' ? '💼 Deals' : t === 'pipeline' ? '📊 Pipeline' : t === 'leads' ? '🎯 Leads' : '➕ Adaugă'}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: '#a78bfa', padding: 40, textAlign: 'center' }}>⚙️ Se încarcă...</div>}

        {/* Deals table */}
        {!loading && activeTab === 'deals' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #7c3aed33', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(124,58,237,0.1)' }}>
                  {['Companie', 'Contact', 'Valoare', 'Etapă', 'Prob.'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12, textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(deals.length ? deals : SAMPLE_DEALS).map((d, i) => (
                  <tr key={d.id || i} style={{ borderTop: '1px solid rgba(124,58,237,0.1)' }}>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontWeight: 600 }}>{d.company}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{d.contact}</td>
                    <td style={{ padding: '12px 16px', color: '#22c55e', fontFamily: 'monospace' }}>${(d.value || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: `${STAGE_COLORS[d.stage] || '#64748b'}22`, color: STAGE_COLORS[d.stage] || '#64748b', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                        {d.stage}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#fbbf24' }}>{d.probability || '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pipeline */}
        {!loading && activeTab === 'pipeline' && (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {pipeline.filter(p => p.stage !== 'closed-lost').map(p => (
              <div key={p.stage} style={{ minWidth: 180, background: 'rgba(255,255,255,0.02)', border: `1px solid ${STAGE_COLORS[p.stage]}44`, borderRadius: 12, padding: 16 }}>
                <div style={{ color: STAGE_COLORS[p.stage], fontWeight: 700, fontSize: 12, textTransform: 'uppercase', marginBottom: 8 }}>{p.stage}</div>
                <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 18, fontWeight: 800 }}>${p.total.toLocaleString()}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{p.deals.length} deal{p.deals.length !== 1 ? 's' : ''}</div>
                {p.deals.map((d, i) => (
                  <div key={i} style={{ marginTop: 8, background: `${STAGE_COLORS[p.stage]}11`, border: `1px solid ${STAGE_COLORS[p.stage]}22`, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{d.company}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>${(d.value || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Leads */}
        {!loading && activeTab === 'leads' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {(leads.length ? leads : SAMPLE_LEADS).map((l, i) => (
              <div key={l.id || i} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid #7c3aed33',
                borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {l.status === 'hot' ? '🔥' : l.status === 'warm' ? '🌡️' : '❄️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{l.name}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{l.email} · {l.source}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: l.score >= 70 ? '#22c55e' : l.score >= 50 ? '#fbbf24' : '#ef4444', fontWeight: 800, fontFamily: 'monospace' }}>{l.score}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>score</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Deal form */}
        {activeTab === 'add' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #7c3aed44', borderRadius: 16, padding: 28 }}>
            <h2 style={{ color: '#e2e8f0', marginBottom: 20, fontSize: 18 }}>➕ Deal Nou</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Companie', key: 'company', placeholder: 'TechCorp SA' },
                { label: 'Contact', key: 'contact', placeholder: 'Ion Popescu' },
                { label: 'Valoare ($)', key: 'value', placeholder: '50000', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }} />
                </div>
              ))}
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Etapă</label>
                <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
                  style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observații despre oportunitate..."
                rows={3}
                style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20 }}>
              <button onClick={addDeal} disabled={saving || !form.company}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: 'none', borderRadius: 10, padding: '10px 28px',
                  color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                  opacity: (saving || !form.company) ? 0.7 : 1,
                }}>
                {saving ? '⏳ Salvez...' : '💾 Adaugă Deal'}
              </button>
              {msg && <span style={{ color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: 13 }}>{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBD;
