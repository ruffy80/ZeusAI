import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function CryptoFiatBridge() {
  const [health, setHealth] = useState(null);
  const [rate, setRate] = useState(null);
  const [services, setServices] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [h, r, s] = await Promise.all([
        axios.get('/api/crypto-bridge/health').catch(() => ({ data: null })),
        axios.get('/api/crypto-bridge/btc-rate').catch(() => ({ data: null })),
        axios.get('/api/crypto-bridge/services').catch(() => ({ data: [] })),
      ]);
      setHealth(h.data || null);
      setRate(r.data || null);
      setServices(Array.isArray(s.data) ? s.data : (s.data?.services || []));
    };
    load();
  }, []);

  const btcUsd = Number(rate?.usd || rate?.rate || 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ padding: 24, borderRadius: 24, background: 'rgba(15,23,42,.7)', border: '1px solid rgba(34,211,238,.2)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Crypto Bridge</div>
        <h1 style={{ margin: '8px 0', fontSize: 40 }}>Crypto ↔ Fiat Bridge Suite</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 820 }}>
          Non-custodial transfer intelligence: smart routing, fee optimization, destination safety and liquidity orchestration.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={{ padding: 18, borderRadius: 20, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(148,163,184,.16)' }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Health</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: health?.ok ? '#4ade80' : '#f87171' }}>{health?.ok ? 'ONLINE' : 'DEGRADED'}</div>
        </div>
        <div style={{ padding: 18, borderRadius: 20, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(148,163,184,.16)' }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>BTC / USD</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#22d3ee' }}>{btcUsd > 0 ? ('$' + btcUsd.toLocaleString()) : 'N/A'}</div>
        </div>
        <div style={{ padding: 18, borderRadius: 20, background: 'rgba(15,23,42,.6)', border: '1px solid rgba(148,163,184,.16)' }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Active services</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#c084fc' }}>{services.length || 0}</div>
        </div>
      </section>

      <section style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
        <h2 style={{ marginTop: 0 }}>Available endpoints</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1', lineHeight: 1.9 }}>
          <li>GET /api/crypto-bridge/health</li>
          <li>GET /api/crypto-bridge/services</li>
          <li>GET /api/crypto-bridge/btc-rate</li>
          <li>POST /api/crypto-bridge/smart-routing</li>
        </ul>
      </section>
    </div>
  );
}
