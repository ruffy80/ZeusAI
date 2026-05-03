import { retryAxios } from '../utils/retryFetch';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function Wealth() {
  const [paymentStats, setPaymentStats] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [btcRate, setBtcRate] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [statsRes, historyRes, btcRes, purchasesRes] = await Promise.all([
          retryAxios({ method: 'get', url: '/api/payment/stats' }),
          retryAxios({ method: 'get', url: '/api/payment/history' }),
          retryAxios({ method: 'get', url: '/api/payment/btc-rate' }),
          retryAxios({ method: 'get', url: '/api/marketplace/purchases/guest' })
        ]);

        setPaymentStats(statsRes.data || null);
        setPaymentHistory(historyRes.data.payments || []);
        setBtcRate(btcRes.data || null);
        setPurchases(purchasesRes.data.purchases || []);

        localStorage.setItem('lastWealthStats', JSON.stringify({
          paymentStats: statsRes.data || null,
          paymentHistory: historyRes.data.payments || [],
          btcRate: btcRes.data || null,
          purchases: purchasesRes.data.purchases || []
        }));
      } catch (err) {
        setError('Live stats unavailable. Showing last known data.');
        const lastStats = localStorage.getItem('lastWealthStats');
        if (lastStats) {
          const parsed = JSON.parse(lastStats);
          setPaymentStats(parsed.paymentStats);
          setPaymentHistory(parsed.paymentHistory);
          setBtcRate(parsed.btcRate);
          setPurchases(parsed.purchases);
        } else {
          setPaymentStats(null);
          setPaymentHistory([]);
          setBtcRate(null);
          setPurchases([]);
        }
      }
      setLoading(false);
    };

    load();
  }, []);

  const grossVolume = useMemo(() => (
    paymentHistory.reduce((sum, payment) => sum + Number(payment.total || 0), 0)
  ), [paymentHistory]);

  const completedReceipts = paymentHistory.filter((payment) => payment.status === 'completed');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Wealth</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Revenue, treasury, and monetization view</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 860 }}>Track transaction performance, crypto reference pricing, and monetized marketplace services from a compact wealth dashboard.</p>
        {loading && (
          <div style={{ color: '#f59e0b', marginTop: 16 }}>Loading stats...</div>
        )}
        {error && !loading && (
          <div style={{ color: '#f87171', marginTop: 16 }}>{error}</div>
        )}
      </section>

      {!loading && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            {[
              { label: 'Completed Revenue', value: '$' + Number(paymentStats?.revenue || 0).toFixed(2), sub: (paymentStats?.completedPayments || 0) + ' settled payments', accent: '#22d3ee' },
              { label: 'Gross Volume', value: '$' + grossVolume.toFixed(2), sub: (paymentHistory.length || 0) + ' total transactions', accent: '#c084fc' },
              { label: 'BTC / USD', value: btcRate ? '$' + Number(btcRate.rate || 0).toLocaleString() : 'Loading...', sub: btcRate?.source || 'live rate', accent: '#f59e0b' },
              { label: 'Purchased Services', value: purchases.length, sub: 'marketplace activations', accent: '#34d399' }
            ].map((card) => (
              <div key={card.label} style={{ padding: 20, borderRadius: 22, background: 'rgba(15,23,42,.58)', border: '1px solid rgba(148,163,184,.16)' }}>
                <div style={{ width: 52, height: 4, borderRadius: 999, background: card.accent, marginBottom: 16 }} />
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{card.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
                <div style={{ color: '#cbd5e1', marginTop: 8 }}>{card.sub}</div>
              </div>
            ))}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
              <h2 style={{ marginTop: 0 }}>Completed receipts</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {completedReceipts.length === 0 ? (
                  <div style={{ color: '#94a3b8' }}>No completed receipts yet.</div>
                ) : completedReceipts.slice(0, 6).map((payment) => (
                  <div key={payment.txId} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{payment.description}</div>
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>{payment.txId}</div>
                      </div>
                      <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
              <h2 style={{ marginTop: 0 }}>Monetized services</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {purchases.length === 0 ? (
                  <div style={{ color: '#94a3b8' }}>No marketplace purchases yet.</div>
                ) : purchases.slice(0, 6).map((purchase) => (
                  <div key={purchase.paymentTxId || purchase.purchasedAt} style={{ padding: 16, borderRadius: 18, background: 'rgba(2,6,23,.4)' }}>
                    <div style={{ fontWeight: 700 }}>{purchase.serviceName}</div>
                    <div style={{ color: '#cbd5e1', marginTop: 6 }}>{purchase.description}</div>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Price: {'$' + Number(purchase.price || 0).toFixed(2)} • Method: {purchase.paymentMethod || 'n/a'}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
