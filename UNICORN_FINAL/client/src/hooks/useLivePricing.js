import { useEffect, useRef, useState } from 'react';

/**
 * useLivePricing — subscribes to the backend live-pricing broker.
 *
 * Strictly additive: this hook is a thin client over GET /api/pricing/live and
 * the SSE stream GET /api/pricing/live/stream. It always falls back gracefully
 * (initial fetch + 60s polling) if EventSource is unavailable or the stream
 * endpoint returns a non-2xx response. Consumers receive:
 *
 *   { snapshot, btcRate, services, status }
 *
 * where `services` is an indexable list keyed by `id` and `btcRate` is the
 * live BTC/USD rate from paymentGateway.getBitcoinRate(). The hook never
 * throws and never blocks rendering.
 */
export default function useLivePricing() {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'live' | 'polling' | 'offline'
  const esRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (data) => {
      if (cancelled || !data || !Array.isArray(data.services)) return;
      setSnapshot(data);
    };

    // Initial pull (works even if SSE is blocked by proxies/CSP).
    fetch('/api/pricing/live', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(apply)
      .catch(() => {});

    if (typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource('/api/pricing/live/stream');
        esRef.current = es;
        es.addEventListener('pricing', (ev) => {
          try { apply(JSON.parse(ev.data)); } catch (_) {}
          if (!cancelled) setStatus('live');
        });
        es.onerror = () => {
          if (cancelled) return;
          setStatus('polling');
          // Drop SSE and switch to polling fallback.
          try { es.close(); } catch (_) {}
          esRef.current = null;
          if (!pollRef.current) {
            pollRef.current = setInterval(() => {
              fetch('/api/pricing/live')
                .then(r => (r.ok ? r.json() : null))
                .then(apply)
                .catch(() => setStatus('offline'));
            }, 60000);
          }
        };
      } catch (_) {
        setStatus('polling');
      }
    } else {
      // No EventSource (legacy browsers): pure polling.
      setStatus('polling');
      pollRef.current = setInterval(() => {
        fetch('/api/pricing/live')
          .then(r => (r.ok ? r.json() : null))
          .then(apply)
          .catch(() => setStatus('offline'));
      }, 60000);
    }

    return () => {
      cancelled = true;
      if (esRef.current) { try { esRef.current.close(); } catch (_) {} esRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const services = snapshot?.services || [];
  const byId = services.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
  return {
    snapshot,
    btcRate: snapshot?.btcRate || null,
    services,
    byId,
    updatedAt: snapshot?.updatedAt || null,
    status,
  };
}
