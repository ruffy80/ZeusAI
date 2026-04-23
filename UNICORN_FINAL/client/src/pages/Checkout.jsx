import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import SEOMeta from '../components/SEOMeta';
// PaymentModal is imported per checkout spec; Step 3 renders its payment logic inline
// to avoid the fixed overlay. This import keeps the dependency relationship explicit.
import PaymentModal from '../components/PaymentModal'; // eslint-disable-line no-unused-vars

const STEPS = ['Select Service', 'Configure', 'Payment', 'Success'];

const COLORS = {
  bg: '#05060e',
  primary: '#00d4ff',
  secondary: '#c084fc',
  accent: '#00ffa3',
  cardBg: 'rgba(15,23,42,0.8)',
  border: 'rgba(0,212,255,0.18)',
};

/* ── Stepper ────────────────────────────────────────────────────── */
function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 48, flexWrap: 'wrap', gap: 4 }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
                background: done
                  ? `linear-gradient(135deg,${COLORS.primary},${COLORS.secondary})`
                  : active
                    ? 'rgba(0,212,255,0.15)'
                    : 'rgba(255,255,255,0.04)',
                border: active
                  ? `2px solid ${COLORS.primary}`
                  : done
                    ? 'none'
                    : '2px solid rgba(255,255,255,0.1)',
                color: done ? '#05060e' : active ? COLORS.primary : '#475569',
                transition: 'all 0.3s',
                boxShadow: active ? `0 0 16px rgba(0,212,255,0.35)` : 'none',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-heading)', letterSpacing: '0.07em',
                color: active ? COLORS.primary : done ? '#94a3b8' : '#334155',
                textAlign: 'center', maxWidth: 70,
              }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                height: 2, width: 48, background: done
                  ? `linear-gradient(90deg,${COLORS.primary},${COLORS.secondary})`
                  : 'rgba(255,255,255,0.06)',
                marginBottom: 22, flexShrink: 0,
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Step 1: Select Service ─────────────────────────────────────── */
function StepSelectService({ onSelect }) {
  const [services, setServices] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/marketplace/services')
      .then(res => setServices(res.data.services || res.data || []))
      .catch(() => setError('Could not load services. Using demo data.'))
      .finally(() => setFetching(false));
  }, []);

  const demoServices = [
    { id: 'starter', name: 'Starter AI Agent', description: 'Automate up to 5 business workflows with our base AI tier.', price: 99, currency: 'USD', tier: 'Starter' },
    { id: 'pro', name: 'Pro Enterprise Suite', description: 'Unlimited agents, advanced analytics, and priority support.', price: 499, currency: 'USD', tier: 'Pro' },
    { id: 'unicorn', name: 'Unicorn Full Platform', description: 'Everything in Pro plus custom model training and dedicated infra.', price: 1499, currency: 'USD', tier: 'Unicorn' },
  ];

  const list = services.length ? services : demoServices;

  const tierColor = (tier = '') => {
    if (tier.toLowerCase().includes('unicorn')) return COLORS.accent;
    if (tier.toLowerCase().includes('pro')) return COLORS.secondary;
    return COLORS.primary;
  };

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '4rem 0', color: COLORS.primary }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
      Loading services…
    </div>
  );

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 24, padding: '10px 16px', borderRadius: 10, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', color: '#fbbf24', fontSize: 13 }}>
          {error}
        </div>
      )}
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8, fontFamily: 'var(--font-heading)' }}>Choose a Service</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Select the plan that fits your needs. Click a card to continue.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
        {list.map((svc) => (
          <button
            key={svc.id || svc.name}
            onClick={() => onSelect(svc)}
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              padding: '28px 24px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = tierColor(svc.tier);
              e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,212,255,0.12)`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = COLORS.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {svc.tier && (
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                color: tierColor(svc.tier),
                background: `${tierColor(svc.tier)}18`,
                border: `1px solid ${tierColor(svc.tier)}44`,
                marginBottom: 12, fontFamily: 'var(--font-heading)',
              }}>{svc.tier.toUpperCase()}</span>
            )}
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 10, fontFamily: 'var(--font-heading)' }}>{svc.name}</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 18 }}>{svc.description}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: tierColor(svc.tier) }}>
              ${svc.price ?? svc.monthly_price ?? '–'}
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 400 }}> / mo</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 2: Configure ──────────────────────────────────────────── */
function StepConfigure({ service, onContinue, onBack }) {
  const [billing, setBilling] = useState('monthly');
  const basePrice = service.price ?? service.monthly_price ?? 199;
  const price = billing === 'annual' ? +(basePrice * 12 * 0.8).toFixed(2) : +basePrice;
  const label = billing === 'annual' ? `$${price} / year  (save 20%)` : `$${price} / month`;

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, marginBottom: 24, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 24, fontFamily: 'var(--font-heading)' }}>Configure Your Plan</h2>

      <div style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: '28px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: COLORS.primary, fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>SELECTED SERVICE</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{service.name}</div>
        <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{service.description}</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>BILLING PERIOD</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {['monthly', 'annual'].map(opt => (
            <button
              key={opt}
              onClick={() => setBilling(opt)}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                border: billing === opt ? `2px solid ${COLORS.primary}` : '2px solid rgba(255,255,255,0.08)',
                background: billing === opt ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                color: billing === opt ? COLORS.primary : '#64748b',
                fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-heading)',
                transition: 'all 0.2s',
              }}
            >
              {opt === 'monthly' ? 'Monthly' : 'Annual (–20%)'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(0,212,255,0.04)', border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: 14 }}>Estimated total</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: COLORS.primary }}>{label}</span>
        </div>
        {billing === 'annual' && (
          <div style={{ marginTop: 8, fontSize: 12, color: COLORS.accent }}>
            ✓ You save ${(basePrice * 12 * 0.2).toFixed(2)} per year with annual billing
          </div>
        )}
      </div>

      <button
        onClick={() => onContinue({ billing, price })}
        style={{
          width: '100%', padding: '16px 24px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg,${COLORS.primary},${COLORS.secondary})`,
          color: '#05060e', fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-heading)',
          letterSpacing: '0.06em', transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        Continue to Payment →
      </button>
    </div>
  );
}

/* ── Step 3: Inline Payment Form ───────────────────────────────── */
function InlinePaymentForm({ service, billing, price, onSuccess, onBack }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState({
    amount: price,
    method: 'crypto_btc',
    description: `${service.name} — ${billing === 'annual' ? 'Annual' : 'Monthly'} Plan`,
  });

  useEffect(() => {
    axios.get('/api/payment/methods')
      .then(res => {
        const available = res.data.methods || [];
        setMethods(available);
        if (available.length && !available.find(m => m.id === form.method)) {
          setForm(prev => ({ ...prev, method: available[0].id }));
        }
      })
      .catch(() => setMethods([]));
  }, []);

  const openExternal = url => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

  const createPayment = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/payment/create', {
        amount: Number(form.amount),
        method: form.method,
        description: form.description,
      });
      setPayment(res.data);
      if (res.data?.checkoutUrl) openExternal(res.data.checkoutUrl);
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
      const res = await axios.post(`/api/payment/process/${payment.txId}`, {
        approved: payment.provider === 'paypal',
        note: 'Checkout wizard payment',
      });
      setPayment(res.data);
      if (res.data.status === 'completed') {
        onSuccess({ txId: res.data.txId, amount: res.data.total, currency: res.data.currency });
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to process payment');
    } finally {
      setLoading(false);
    }
  };

  const completionLabel = payment?.status === 'completed' ? 'Payment Completed'
    : payment?.provider === 'paypal' ? 'Capture PayPal Payment'
    : payment?.provider === 'stripe' ? 'Verify Stripe Payment'
    : 'Confirm Payment';

  const inputStyle = {
    padding: 12, borderRadius: 12, width: '100%', boxSizing: 'border-box',
    border: '1px solid rgba(148,163,184,0.2)',
    background: 'rgba(15,23,42,0.7)', color: '#e2e8f0', fontSize: 14,
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, marginBottom: 24, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Back
      </button>
      <div style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: '32px 28px', color: '#e2e8f0' }}>
        <div style={{ marginBottom: 6, color: COLORS.primary, fontSize: 13, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)' }}>UNIVERSAL PAYMENT GATEWAY</div>
        <h2 style={{ margin: '0 0 24px', fontSize: 26, fontWeight: 700, color: '#f1f5f9', fontFamily: 'var(--font-heading)' }}>Secure Checkout</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <label style={{ display: 'grid', gap: 8, fontSize: 14, color: '#94a3b8' }}>
            Amount (USD)
            <input type="number" min="1" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8, fontSize: 14, color: '#94a3b8' }}>
            Payment Method
            <select value={form.method} onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))} style={inputStyle}>
              {methods.length ? methods.map(m => (
                <option key={m.id} value={m.id}>{m.name} · {m.currency}</option>
              )) : (
                <option value="card">Credit Card · USD</option>
              )}
            </select>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 8, fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
          Description
          <input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} style={inputStyle} />
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={createPayment} disabled={loading} style={{
            flex: 1, padding: '14px 18px', borderRadius: 14, border: 'none',
            background: `linear-gradient(90deg,${COLORS.primary},${COLORS.secondary})`,
            color: '#05060e', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Working…' : 'Create Payment'}
          </button>
        </div>

        {payment && (
          <div style={{ marginTop: 24, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,0.6)', border: `1px solid rgba(34,211,238,0.18)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Transaction ID</div>
                <div style={{ color: '#f8fafc', fontWeight: 700 }}>{payment.txId}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Status</div>
                <div style={{ color: payment.status === 'completed' ? '#4ade80' : '#facc15', fontWeight: 700 }}>{payment.status}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Total</div>
                <div style={{ color: COLORS.primary, fontWeight: 700 }}>${Number(payment.total || 0).toFixed(2)} {payment.currency}</div>
              </div>
            </div>

            {payment.qrCode && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <img src={payment.qrCode} alt="Payment QR" style={{ width: 110, height: 110, borderRadius: 12, background: '#fff', padding: 8 }} />
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Wallet address</div>
                  <div style={{ maxWidth: 320, wordBreak: 'break-all', fontSize: 13 }}>{payment.walletAddress}</div>
                  {payment.cryptoAmount && <div style={{ marginTop: 8, color: COLORS.secondary }}>Due: {payment.cryptoAmount} {payment.method === 'crypto_btc' ? 'BTC' : 'ETH'}</div>}
                </div>
              </div>
            )}

            {payment.checkoutUrl && (
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(88,28,135,0.12)' }}>
                <div style={{ color: COLORS.secondary, fontWeight: 700, marginBottom: 6 }}>Provider checkout required</div>
                <div style={{ color: '#cbd5e1', fontSize: 13 }}>Complete payment in the provider window, then return and verify.</div>
                <button onClick={() => openExternal(payment.checkoutUrl)} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#a855f7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {payment.provider === 'paypal' ? 'Open PayPal' : 'Open Stripe'}
                </button>
              </div>
            )}

            <button onClick={completePayment} disabled={loading || payment.status === 'completed'} style={{
              padding: '12px 20px', borderRadius: 12, border: 'none',
              background: payment.status === 'completed' ? '#14532d' : '#22c55e',
              color: '#020617', fontWeight: 700, cursor: payment.status === 'completed' ? 'default' : 'pointer',
            }}>
              {completionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 4: Success ────────────────────────────────────────────── */
function StepSuccess({ service, billing, txResult, onDashboard, onBuyAnother }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
        background: `linear-gradient(135deg,${COLORS.accent},${COLORS.primary})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, boxShadow: `0 0 40px rgba(0,255,163,0.3)`,
      }}>✓</div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 8, fontFamily: 'var(--font-heading)' }}>Payment Successful!</h2>
      <p style={{ color: '#64748b', fontSize: 15, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
        Your order has been confirmed. You'll receive an email confirmation shortly.
      </p>

      <div style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: '24px 28px', maxWidth: 480, margin: '0 auto 32px', textAlign: 'left' }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 16 }}>ORDER SUMMARY</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { label: 'Service', value: service.name },
            { label: 'Billing', value: billing === 'annual' ? 'Annual (20% off)' : 'Monthly' },
            { label: 'Amount Paid', value: txResult?.amount ? `$${Number(txResult.amount).toFixed(2)} ${txResult.currency || 'USD'}` : '—' },
            { label: 'Transaction ID', value: txResult?.txId || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', wordBreak: 'break-all', maxWidth: 240, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onDashboard}
          style={{
            padding: '14px 28px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg,${COLORS.primary},${COLORS.secondary})`,
            color: '#05060e', fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-heading)',
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={onBuyAnother}
          style={{
            padding: '14px 28px', borderRadius: 14, cursor: 'pointer',
            border: `1px solid ${COLORS.border}`,
            background: 'rgba(255,255,255,0.03)',
            color: '#94a3b8', fontWeight: 600, fontSize: 15,
          }}
        >
          Buy Another Service
        </button>
      </div>
    </div>
  );
}

/* ── Main Checkout Page ──────────────────────────────────────────── */
export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();

  const preselectedPlan = location.state?.plan || null;
  const preselectedService = preselectedPlan
    ? {
        id: preselectedPlan.id || preselectedPlan.name?.toLowerCase().replace(/\s+/g, '-') || 'custom',
        name: preselectedPlan.name,
        description: preselectedPlan.description || '',
        price: Number(preselectedPlan.price) || 0,
        tier: preselectedPlan.tier || preselectedPlan.name,
      }
    : null;

  const [step, setStep] = useState(preselectedService ? 1 : 0);
  const [selectedService, setSelectedService] = useState(preselectedService);
  const [configData, setConfigData] = useState({ billing: 'monthly', price: preselectedService?.price || 0 });
  const [txResult, setTxResult] = useState(null);

  const handleServiceSelect = (svc) => {
    setSelectedService(svc);
    setStep(1);
  };

  const handleConfigure = (data) => {
    setConfigData(data);
    setStep(2);
  };

  const handlePaymentSuccess = (result) => {
    setTxResult(result);
    setStep(3);
  };

  const handleBuyAnother = () => {
    setStep(0);
    setSelectedService(null);
    setConfigData({ billing: 'monthly', price: 0 });
    setTxResult(null);
  };

  return (
    <>
      <SEOMeta title="Checkout — Unicorn" canonicalPath="/checkout" description="Complete your purchase of Unicorn AI platform services." />

      <div style={{ minHeight: '80vh', paddingTop: 16 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px' }}>
          <Stepper current={step} />

          {step === 0 && (
            <StepSelectService onSelect={handleServiceSelect} />
          )}

          {step === 1 && selectedService && (
            <StepConfigure
              service={selectedService}
              onContinue={handleConfigure}
              onBack={() => setStep(0)}
            />
          )}

          {step === 2 && selectedService && (
            <InlinePaymentForm
              service={selectedService}
              billing={configData.billing}
              price={configData.price}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && selectedService && (
            <StepSuccess
              service={selectedService}
              billing={configData.billing}
              txResult={txResult}
              onDashboard={() => navigate('/dashboard')}
              onBuyAnother={handleBuyAnother}
            />
          )}
        </div>
      </div>
    </>
  );
}
