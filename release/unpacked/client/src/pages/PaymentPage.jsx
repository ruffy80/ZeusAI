import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import PaymentModal from '../components/PaymentModal';

export default function PaymentPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [btcRate, setBtcRate] = useState(null);
  const [marketplacePurchases, setMarketplacePurchases] = useState([]);
  const featuredPlan = useMemo(() => ({
    name: 'Unicorn Prime',
    description: 'Global deployment, AI operations, luxury UX, and automated growth stack.',
    price: 499
  }), []);

  const marketplaceReceipts = useMemo(() => (
    history.filter((payment) => payment.metadata?.source === 'marketplace')
  ), [history]);

  const fetchData = async () => {
    try {
      const [statsRes, historyRes, btcRes, purchasesRes] = await Promise.all([
        axios.get('/api/payment/stats'),
        axios.get('/api/payment/history'),
        axios.get('/api/payment/btc-rate'),
        axios.get('/api/marketplace/purchases/guest')
      ]);
      setStats(statsRes.data || null);
      setHistory(historyRes.data.payments || []);
      setBtcRate(btcRes.data || null);
      setMarketplacePurchases(purchasesRes.data.purchases || []);
    } catch (err) {
      console.error('Payment page load failed', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 24, borderRadius: 24, background: 'rgba(15,23,42,.7)', border: '1px solid rgba(34,211,238,.2)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Payments</div>
        <h1 style={{ margin: '8px 0', fontSize: 42 }}>Universal payment command center</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 760 }}>{featuredPlan.description}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Featured plan</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{featuredPlan.name}</div>
            <div style={{ color: '#22d3ee', fontSize: 24, fontWeight: 700 }}>{'$' + Number(featuredPlan.price || 0).toFixed(2)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>BTC / USD</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{btcRate ? '$' + Number(btcRate.rate || 0).toLocaleString() : 'Loading...'}</div>
            <div style={{ color: '#c084fc', fontSize: 13 }}>{btcRate?.source || 'live'}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.45)', minWidth: 220 }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Completed volume</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{'$' + Number(stats?.revenue || 0).toFixed(2)}</div>
            <div style={{ color: '#4ade80', fontSize: 13 }}>{stats?.completedPayments || 0} settled payments</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(true)} style={{ marginTop: 22, padding: '14px 20px', borderRadius: 16, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 800, cursor: 'pointer' }}>
          Launch Payment Modal
        </button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          ['Transactions', stats?.totalPayments || 0, '#22d3ee'],
          ['Pending', stats?.pendingPayments || 0, '#facc15'],
          ['Methods Active', stats?.activeMethods || 0, '#c084fc']
        ].map(([label, value, color]) => (
          <div key={label} style={{ padding: 18, borderRadius: 20, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(148,163,184,.16)' }}>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Recent payments</h2>
          <button onClick={fetchData} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.2)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {history.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>No payments yet. Create one to populate live transaction history.</div>
          ) : history.slice(0, 6).map((payment) => (
            <div key={payment.txId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: 14, borderRadius: 16, background: 'rgba(2,6,23,.4)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{payment.description}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
              </div>
              <div>{payment.method}</div>
              <div>{'$' + Number(payment.total || 0).toFixed(2)}</div>
              <div style={{ color: payment.status === 'completed' ? '#4ade80' : '#facc15', fontWeight: 700 }}>{payment.status}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Marketplace receipts</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {marketplaceReceipts.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No marketplace receipts yet. Buy a service from the marketplace to generate linked receipts.</div>
            ) : marketplaceReceipts.slice(0, 6).map((payment) => (
              <div key={payment.txId} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)', border: '1px solid rgba(34,211,238,.14)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{payment.metadata?.serviceName || payment.description}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
                  </div>
                  <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2)}</div>
                </div>
                <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 14 }}>{payment.metadata?.description || 'Marketplace service purchase'}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
                  <span>Status: {payment.status}</span>
                  <span>Method: {payment.method}</span>
                  <span>Created: {new Date(payment.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Purchased services</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {marketplacePurchases.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No activated marketplace services yet.</div>
            ) : marketplacePurchases.slice(0, 6).map((purchase) => (
              <div key={purchase.paymentTxId || purchase.purchasedAt} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                <div style={{ fontWeight: 700 }}>{purchase.serviceName}</div>
                <div style={{ color: '#cbd5e1', fontSize: 14, marginTop: 4 }}>{purchase.description}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' }}>
                  <span>Category: {purchase.category}</span>
                  <span>Price: {'$' + Number(purchase.price || 0).toFixed(2)}</span>
                  <span>Method: {purchase.paymentMethod || 'n/a'}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#67e8f9' }}>Receipt: {purchase.paymentTxId || 'pending-link'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        presetAmount={featuredPlan.price}
        presetDescription={featuredPlan.name}
        clientId="guest"
        metadata={{ source: 'payments_page', plan: featuredPlan.name }}
        onCompleted={() => {
          setIsOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
