import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

/**
 * ESIM — digital connectivity desk (honest marketplace bridge).
 * Surfaces catalog SKUs tagged esim/connectivity when present; else guides to marketplace.
 */
export default function ESIM() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/catalog', { timeout: 8000 });
        const catalog = res.data && (res.data.services || res.data.items || res.data.catalog || []);
        const list = Array.isArray(catalog) ? catalog : [];
        const filtered = list.filter((s) => {
          const blob = JSON.stringify(s || {}).toLowerCase();
          return /esim|e-sim|connectivity|roaming|data.?plan/.test(blob);
        });
        if (!cancelled) setItems(filtered.slice(0, 24));
      } catch (e) {
        if (!cancelled) setError(e.message || 'catalog_unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-body, Georgia, serif)' }}>
      <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        ZeusAI · Connectivity
      </p>
      <h1 style={{ fontFamily: 'var(--font-heading, "Playfair Display", serif)', fontSize: 'clamp(2rem, 5vw, 3.2rem)', margin: '0 0 12px' }}>
        eSIM Desk
      </h1>
      <p style={{ maxWidth: 560, lineHeight: 1.55, opacity: 0.85, marginBottom: 28 }}>
        Digital connectivity offerings from the live Unicorn catalog. Checkout stays on real commerce rails — no invented coverage claims.
      </p>

      {loading && <p>Loading catalog…</p>}
      {error && (
        <p style={{ opacity: 0.8 }}>
          Catalog temporarily unavailable ({error}). Browse the{' '}
          <Link to="/marketplace" style={{ color: '#facc15' }}>marketplace</Link> instead.
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div>
          <p style={{ marginBottom: 16 }}>No dedicated eSIM SKUs in catalog yet — open the full marketplace.</p>
          <Link
            to="/marketplace"
            style={{
              display: 'inline-block',
              padding: '12px 20px',
              background: 'linear-gradient(120deg, #0f766e, #155e75)',
              color: '#f8fafc',
              textDecoration: 'none',
              borderRadius: 4,
            }}
          >
            Open marketplace
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {items.map((s) => {
          const id = s.id || s.serviceId || s.sku;
          const title = s.name || s.title || id;
          const price = s.priceUsd ?? s.price ?? s.usd;
          return (
            <article key={id} style={{ borderTop: '1px solid rgba(250,204,21,0.35)', paddingTop: 12 }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 8px' }}>{title}</h2>
              {price != null && <p style={{ margin: '0 0 12px', opacity: 0.8 }}>${Number(price).toFixed(2)}</p>}
              <Link to={`/checkout?serviceId=${encodeURIComponent(id)}`} style={{ color: '#facc15' }}>
                Checkout
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
