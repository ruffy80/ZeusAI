// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ==================== ANALYTICS ENGINE (REAL) ====================
// Agregare reală de metrici peste seturi de evenimente: count, sum, avg,
// min, max, stddev, percentile (p50/p90/p95/p99), group-by, time-bucketing,
// și detecție trend (slope regresie liniară). Real math, deterministic.

const { createEngine } = require('./engine-core');

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function stats(values) {
  const xs = values.map(num).filter(v => v !== null);
  const n = xs.length;
  if (!n) return { count: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  const sum = xs.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const pct = (p) => sorted[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))];
  return {
    count: n,
    sum: Number(sum.toFixed(4)),
    avg: Number(mean.toFixed(4)),
    min: sorted[0],
    max: sorted[n - 1],
    stddev: Number(Math.sqrt(variance).toFixed(4)),
    p50: pct(50), p90: pct(90), p95: pct(95), p99: pct(99),
  };
}

// Trend prin regresie liniară reală (least squares) → pantă + direcție.
function trend(series) {
  const ys = series.map(num).filter(v => v !== null);
  const n = ys.length;
  if (n < 2) return { slope: 0, direction: 'flat', confidence: 0 };
  const xs = ys.map((_, i) => i);
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const denom = (n * sxx - sx * sx) || 1;
  const slope = (n * sxy - sx * sy) / denom;
  const meanY = sy / n;
  // R² ca încredere
  const intercept = meanY - slope * (sx / n);
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0) || 1;
  const ssRes = ys.reduce((a, y, i) => a + (y - (slope * i + intercept)) ** 2, 0);
  const r2 = Math.max(0, 1 - ssRes / ssTot);
  return {
    slope: Number(slope.toFixed(6)),
    direction: slope > 0.001 ? 'up' : slope < -0.001 ? 'down' : 'flat',
    confidence: Number(r2.toFixed(4)),
  };
}

function analyticsWork(input = {}) {
  const { events = [], metric = 'value', groupBy = null, bucketMs = 0 } = input;
  const arr = Array.isArray(events) ? events : [];
  const values = arr.map(e => (e && typeof e === 'object') ? e[metric] : e);

  const result = { totalEvents: arr.length, metric, overall: stats(values) };

  // group-by real
  if (groupBy) {
    const groups = {};
    for (const e of arr) {
      const key = (e && typeof e === 'object') ? String(e[groupBy]) : 'undefined';
      (groups[key] = groups[key] || []).push((e && typeof e === 'object') ? e[metric] : e);
    }
    result.groups = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, stats(v)]));
  }

  // time-bucketing + trend real
  if (bucketMs > 0) {
    const buckets = new Map();
    for (const e of arr) {
      const ts = (e && e.ts) ? new Date(e.ts).getTime() : null;
      if (ts == null || Number.isNaN(ts)) continue;
      const b = Math.floor(ts / bucketMs) * bucketMs;
      (buckets.get(b) || buckets.set(b, []).get(b)).push((e && typeof e === 'object') ? e[metric] : e);
    }
    const ordered = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const seriesAvg = ordered.map(([, v]) => stats(v).avg || 0);
    result.timeline = ordered.map(([b, v]) => ({ bucket: new Date(b).toISOString(), ...stats(v) }));
    result.trend = trend(seriesAvg);
  } else {
    result.trend = trend(values);
  }

  return result;
}

const engine = createEngine('analytics', { label: 'Analytics Engine', category: 'intelligence', work: analyticsWork });
module.exports = {
  name: 'analytics',
  process: (input, ctx) => engine.process(input, ctx),
  analyze: (input) => analyticsWork(input),
  stats, trend,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
