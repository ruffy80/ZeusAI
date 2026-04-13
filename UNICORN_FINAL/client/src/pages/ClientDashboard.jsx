import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const PLAN_LABELS = { free: 'Free 🆓', starter: 'Starter ⭐', pro: 'Pro 💎', enterprise: 'Enterprise 🏆' };
const PLAN_COLORS = { free: '#64748b', starter: '#22d3ee', pro: '#a855f7', enterprise: '#f59e0b' };

export default function ClientDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [plans, setPlans] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const headers = { Authorization: 'Bearer ' + token };
    Promise.all([
      axios.get('/api/auth/me', { headers }),
      axios.get('/api/payment/history', { headers }),
      axios.get('/api/marketplace/purchases/' + (user.id || 'guest')),
      axios.get('/api/billing/plans/public'),
      axios.get('/api/platform/api-keys/mine', { headers }),
    ]).then(([meRes, payRes, purRes, planRes, keyRes]) => {
      setMe(meRes.data);
      setPayments(payRes.data.payments || []);
      setPurchases(purRes.data.purchases || []);
      setPlans(planRes.data.plans || []);
      setApiKeys(keyRes.data.keys || []);
    }).catch(err => {
      if (err.response?.status === 401) { toast.error('Sesiune expirată – te rugăm să te autentifici din nou'); }
    }).finally(() => setLoading(false));
  }, [token, user.id]);

  const createApiKey = async () => {
    const keyName = 'API Key ' + new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
    try {
      const res = await axios.post('/api/platform/api-keys/create', { name: keyName, planId: me?.planId || 'free' }, { headers: { Authorization: 'Bearer ' + token } });
      setApiKeys(prev => [...prev, res.data]);
      toast.success('API Key creat: ' + res.data.key);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Eroare creare cheie');
    }
  };

  const box = { padding: 20, borderRadius: 20, background: 'rgba(15,23,42,.65)', border: '1px solid rgba(148,163,184,.12)' };
  const badge = (plan) => ({ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: (PLAN_COLORS[plan] || '#64748b') + '22', color: PLAN_COLORS[plan] || '#64748b', fontWeight: 700, fontSize: 13, border: '1px solid ' + (PLAN_COLORS[plan] || '#64748b') + '44' });

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Se încarcă...</div>;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <section style={{ padding: 24, borderRadius: 24, background: 'linear-gradient(135deg,rgba(34,211,238,.1),rgba(168,85,247,.1))', border: '1px solid rgba(34,211,238,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 12 }}>Dashboard Client</div>
            <h1 style={{ margin: '6px 0 4px', fontSize: 28 }}>👋 Bun venit, {me?.name || user.name}</h1>
            <p style={{ color: '#94a3b8', margin: 0 }}>{me?.email}</p>
          </div>
          <div>
            <span style={badge(me?.planId || 'free')}>{PLAN_LABELS[me?.planId || 'free']}</span>
            {me?.emailVerified ? <span style={{ marginLeft: 8, color: '#34d399', fontSize: 13 }}>✓ Email verificat</span> : <span style={{ marginLeft: 8, color: '#f87171', fontSize: 13 }}>⚠ Email neverificat</span>}
          </div>
        </div>
      </section>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        {[
          { label: 'Plăți totale', value: payments.length, icon: '💳', color: '#22d3ee' },
          { label: 'Volum plătit', value: '$' + payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.total || 0), 0).toFixed(2), icon: '💰', color: '#34d399' },
          { label: 'Servicii cumpărate', value: purchases.length, icon: '🛒', color: '#a855f7' },
          { label: 'API Keys active', value: apiKeys.length, icon: '🔑', color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ ...box, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{stat.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, margin: '4px 0' }}>{stat.value}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Recent payments */}
        <div style={box}>
          <h3 style={{ margin: '0 0 14px', color: '#22d3ee' }}>💳 Ultimele Plăți</h3>
          {payments.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>Nicio plată încă. <Link to="/payments" style={{ color: '#22d3ee' }}>Fă prima plată</Link></p>
          ) : payments.slice(0, 5).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,.08)', fontSize: 13 }}>
              <span style={{ color: '#cbd5e1' }}>{p.description?.substring(0, 30) || p.method}</span>
              <span style={{ color: p.status === 'completed' ? '#34d399' : '#f87171', fontWeight: 600 }}>${(p.total || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={box}>
          <h3 style={{ margin: '0 0 14px', color: '#a855f7' }}>📦 Planul tău & Upgrade</h3>
          {plans.slice(0, 3).map(plan => (
            <div key={plan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 10, marginBottom: 8, background: plan.id === (me?.planId || 'free') ? 'rgba(34,211,238,.1)' : 'rgba(2,6,23,.4)', border: '1px solid ' + (plan.id === (me?.planId || 'free') ? 'rgba(34,211,238,.3)' : 'transparent') }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: PLAN_COLORS[plan.id] || '#f8fafc' }}>{plan.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{plan.priceMonthly === 0 ? 'Gratuit' : '$' + plan.priceMonthly + '/lună'}</div>
              </div>
              {plan.id !== (me?.planId || 'free') && (
                <Link to="/payments" style={{ padding: '4px 12px', borderRadius: 8, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>Upgrade</Link>
              )}
              {plan.id === (me?.planId || 'free') && <span style={{ color: '#34d399', fontSize: 12 }}>✓ Activ</span>}
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#f59e0b' }}>🔑 API Keys</h3>
          <button onClick={createApiKey} style={{ padding: '6px 16px', borderRadius: 10, border: 0, background: 'rgba(245,158,11,.2)', color: '#f59e0b', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(245,158,11,.3)' }}>+ Cheie nouă</button>
        </div>
        {apiKeys.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>Nicio cheie API. Creează una pentru acces programatic.</p>
        ) : apiKeys.map((k, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'rgba(2,6,23,.4)', marginBottom: 6, fontSize: 13 }}>
            <div>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{k.name}</span>
              <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>Plan: {k.planId}</span>
            </div>
            <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: 11 }}>{k.keyId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
