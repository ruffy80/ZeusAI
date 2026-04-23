import React, { useEffect, useState } from 'react';
import axios from 'axios';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.82)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const panelStyle = {
  width: 'min(680px, 92vw)',
  borderRadius: 24,
  border: '1px solid rgba(34,211,238,.25)',
  background: 'linear-gradient(180deg, rgba(15,23,42,.96), rgba(17,24,39,.96))',
  boxShadow: '0 20px 80px rgba(0,0,0,.45)',
  padding: 24,
  color: '#e2e8f0'
};

export default function PaymentModal({ isOpen, onClose, presetAmount = 199, presetDescription = 'Premium Unicorn Service', clientId = 'guest', metadata = {}, onCompleted }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState({ amount: presetAmount, method: 'crypto_btc', description: presetDescription });

  useEffect(() => {
    if (!isOpen) return;
    setPayment(null);
    axios.get('/api/payment/methods')
      .then((res) => {
        const available = res.data.methods || [];
        setMethods(available);
        const hasBtc = available.find((item) => item.id === 'crypto_btc');
        if (!hasBtc && available.length && !available.find((item) => item.id === form.method)) {
          setForm((prev) => ({ ...prev, method: available[0].id }));
        }
      })
      .catch(() => setMethods([]));
  }, [isOpen]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, amount: presetAmount, description: presetDescription }));
  }, [presetAmount, presetDescription]);

  useEffect(() => {
    if (!isOpen) {
      setPayment(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openExternalCheckout = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const createPayment = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/payment/create', {
        amount: Number(form.amount),
        method: form.method,
        description: form.description,
        clientId,
        metadata
      });
      setPayment(res.data);
      if (res.data?.checkoutUrl) {
        openExternalCheckout(res.data.checkoutUrl);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to create payment');
    } finally {
      setLoading(false);
    }
  };

  const completePayment = async () => {
    if (!payment?.txId) return;
    try {
      setLoading(true);
      const res = await axios.post('/api/payment/process/' + payment.txId, {
        approved: payment.provider === 'paypal',
        note: payment.provider ? 'Verified from modal' : 'Processed from modal'
      });
      setPayment(res.data);
      if (res.data.status === 'completed' && onCompleted) onCompleted(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to process payment');
    } finally {
      setLoading(false);
    }
  };

  const completionLabel = payment?.status === 'completed'
    ? 'Payment Completed'
    : payment?.provider === 'paypal'
      ? 'Capture PayPal Payment'
      : payment?.provider === 'stripe'
        ? 'Verify Stripe Payment'
        : 'Confirm Payment';

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ color: '#22d3ee', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>Universal Payment Gateway</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 30 }}>Secure checkout</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#94a3b8', fontSize: 26, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Amount</span>
            <input type="number" min="1" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Method</span>
            <select value={form.method} onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }}>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>{method.name} · {method.currency}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <span>Description</span>
          <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(148,163,184,.25)', background: 'rgba(15,23,42,.7)', color: '#fff' }} />
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={createPayment} disabled={loading} style={{ flex: 1, padding: '12px 18px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Working...' : 'Create Payment'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(148,163,184,.25)', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

        {payment && (
          <div style={{ marginTop: 24, padding: 18, borderRadius: 18, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(34,211,238,.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Transaction ID</div>
                <div style={{ color: '#f8fafc', fontWeight: 700 }}>{payment.txId}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Status</div>
                <div style={{ color: payment.status === 'completed' ? '#4ade80' : '#facc15', fontWeight: 700 }}>{payment.status}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Total</div>
                <div style={{ color: '#22d3ee', fontWeight: 700 }}>{'$' + Number(payment.total || 0).toFixed(2) + ' ' + payment.currency}</div>
              </div>
            </div>

            {payment.qrCode && (
              <div style={{ marginTop: 18, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <img src={payment.qrCode} alt="Payment QR" style={{ width: 120, height: 120, borderRadius: 14, background: '#fff', padding: 8 }} />
                <div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Wallet address</div>
                  <div style={{ maxWidth: 360, wordBreak: 'break-all' }}>{payment.walletAddress}</div>
                  {payment.cryptoAmount ? <div style={{ marginTop: 8, color: '#c084fc' }}>Amount due: {payment.cryptoAmount} {payment.method === 'crypto_btc' ? 'BTC' : 'ETH'}</div> : null}
                </div>
              </div>
            )}

            {payment.checkoutUrl && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid rgba(168,85,247,.28)', background: 'rgba(88,28,135,.12)' }}>
                <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: 6 }}>Provider checkout required</div>
                <div style={{ color: '#cbd5e1', fontSize: 14 }}>Complete payment in the provider window, then come back here and verify the status.</div>
                <button onClick={() => openExternalCheckout(payment.checkoutUrl)} style={{ marginTop: 12, padding: '10px 16px', borderRadius: 12, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {payment.provider === 'paypal' ? 'Open PayPal Checkout' : 'Open Stripe Checkout'}
                </button>
              </div>
            )}

            {payment.processorResponse?.note && (
              <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>{payment.processorResponse.note}</div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button onClick={completePayment} disabled={loading || payment.status === 'completed'} style={{ padding: '10px 16px', borderRadius: 12, border: 0, background: payment.status === 'completed' ? '#14532d' : '#22c55e', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
                {completionLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
