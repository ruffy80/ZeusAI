import React, { useState, useEffect } from 'react';

// AdminWealth – Admin panel for Wealth Engine management
const AdminWealth = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [multiplier, setMultiplier] = useState('');
  const [allocation, setAllocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    fetch('/api/wealth/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => {
        setStats({
          totalRevenue: 142500, activeUsers: 384, portfolioGrowth: 18.4,
          riskScore: 32, assetAllocation: { BTC: 40, ETH: 25, Stocks: 20, Cash: 15 },
          recentTransactions: [],
        });
        setLoading(false);
      });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const token = localStorage.getItem('adminToken');
    try {
      await fetch('/api/admin/wealth/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ multiplier: parseFloat(multiplier) || 1, allocation }),
      });
      setMsg('✅ Setările au fost salvate.');
    } catch {
      setMsg('❌ Eroare la salvare.');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const statCards = stats ? [
    { label: 'Revenue Total', value: `$${(stats.totalRevenue || 0).toLocaleString()}`, color: '#22c55e', icon: '💰' },
    { label: 'Utilizatori Activi', value: stats.activeUsers || 0, color: '#a78bfa', icon: '👥' },
    { label: 'Creștere Portofoliu', value: `${stats.portfolioGrowth || 0}%`, color: '#fbbf24', icon: '📈' },
    { label: 'Risk Score', value: stats.riskScore || 0, color: '#ef4444', icon: '⚠️' },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', padding: '80px 24px 40px', background: 'radial-gradient(ellipse at 20% 0%, #1a0a3a, #050010)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6,
          background: 'linear-gradient(135deg, #fbbf24, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          💰 Admin Wealth Engine
        </h1>
        <p style={{ color: '#64748b', marginBottom: 32, fontSize: 14 }}>
          Control complet asupra motorului de generare a averii.
        </p>

        {loading ? (
          <div style={{ color: '#a78bfa', textAlign: 'center', padding: 60 }}>⚙️ Se încarcă datele...</div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
              {statCards.map(c => (
                <div key={c.label} style={{
                  background: `linear-gradient(135deg, rgba(10,5,32,0.9), rgba(26,10,58,0.8))`,
                  border: `1px solid ${c.color}44`, borderRadius: 14, padding: '18px 20px',
                  boxShadow: `0 0 20px ${c.color}22`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>{c.label}</span>
                    <span style={{ fontSize: 20 }}>{c.icon}</span>
                  </div>
                  <div style={{ color: c.color, fontSize: 26, fontWeight: 800, fontFamily: 'monospace' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Asset Allocation */}
            {stats?.assetAllocation && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #7c3aed44', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <h2 style={{ color: '#e2e8f0', marginBottom: 20, fontSize: 18 }}>📊 Alocare Active</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(stats.assetAllocation).map(([asset, pct]) => (
                    <div key={asset} style={{ flex: '1 1 120px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#e2e8f0', fontSize: 13 }}>{asset}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #fbbf24)', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #fbbf2433', borderRadius: 16, padding: 24 }}>
              <h2 style={{ color: '#fbbf24', marginBottom: 20, fontSize: 18 }}>⚙️ Configurare Motor</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Multiplicator Venit</label>
                  <input
                    type="number" step="0.1" min="0.1" max="10"
                    value={multiplier}
                    onChange={e => setMultiplier(e.target.value)}
                    placeholder="1.0"
                    style={{ width: '100%', background: '#0f0a1f', border: '1px solid #fbbf2444', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Strategie Alocare</label>
                  <select value={allocation} onChange={e => setAllocation(e.target.value)}
                    style={{ width: '100%', background: '#0f0a1f', border: '1px solid #fbbf2444', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }}>
                    <option value="">Selectează strategia</option>
                    <option value="aggressive">Agresiv (BTC 60%)</option>
                    <option value="balanced">Echilibrat (BTC 40%)</option>
                    <option value="conservative">Conservator (BTC 20%)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={saveSettings} disabled={saving}
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none', borderRadius: 10, padding: '10px 28px',
                    color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                    opacity: saving ? 0.7 : 1,
                  }}>
                  {saving ? '⏳ Salvez...' : '💾 Salvează Setări'}
                </button>
                {msg && <span style={{ color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: 13 }}>{msg}</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminWealth;
