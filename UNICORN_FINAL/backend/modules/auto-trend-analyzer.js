// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ AUTO TREND ANALYZER ENGINE (REAL) ============
// Detecție reală de tendințe pe serii temporale: medii mobile (SMA/EMA),
// momentum, RSI, detecție spike (z-score), și clasificare regim
// (breakout / accelerare / decelerare / reversal). No mock — math reală.

const { createEngine } = require('./engine-core');

function toSeries(input) {
  if (Array.isArray(input)) return input.map(Number).filter(Number.isFinite);
  if (input && Array.isArray(input.series)) return input.series.map(Number).filter(Number.isFinite);
  if (input && Array.isArray(input.points)) return input.points.map(p => Number(p && p.value)).filter(Number.isFinite);
  return [];
}

function sma(xs, period) {
  if (xs.length < period) return null;
  const slice = xs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(xs, period) {
  if (!xs.length) return null;
  const k = 2 / (period + 1);
  let e = xs[0];
  for (let i = 1; i < xs.length; i++) e = xs[i] * k + e * (1 - k);
  return e;
}

// RSI real (Wilder smoothing) pe perioada dată.
function rsi(xs, period = 14) {
  if (xs.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = xs[i] - xs[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

// Detecție spike-uri prin z-score real.
function spikes(xs, threshold = 2.5) {
  const n = xs.length;
  if (n < 4) return [];
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1e-9;
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = (xs[i] - mean) / sd;
    if (Math.abs(z) >= threshold) out.push({ index: i, value: xs[i], z: Number(z.toFixed(2)) });
  }
  return out;
}

function classify(xs) {
  if (xs.length < 4) return 'insufficient-data';
  const shortMA = sma(xs, Math.max(2, Math.floor(xs.length / 4)));
  const longMA = sma(xs, Math.max(3, Math.floor(xs.length / 2)));
  const r = rsi(xs);
  const last = xs[xs.length - 1], prev = xs[xs.length - 2];
  const accel = (last - prev) - (prev - (xs[xs.length - 3] ?? prev));
  if (shortMA != null && longMA != null) {
    if (shortMA > longMA && accel > 0) return 'breakout-up';
    if (shortMA < longMA && accel < 0) return 'breakdown';
    if (shortMA > longMA && accel < 0) return 'decelerating-up';
    if (shortMA < longMA && accel > 0) return 'recovering';
  }
  if (r != null && r > 70) return 'overbought';
  if (r != null && r < 30) return 'oversold';
  return 'consolidating';
}

function trendWork(input = {}) {
  const xs = toSeries(input);
  if (xs.length < 2) return { regime: 'insufficient-data', points: xs.length };
  const first = xs[0], last = xs[xs.length - 1];
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const momentum = last - (xs[xs.length - 2] || last);
  return {
    points: xs.length,
    regime: classify(xs),
    changePercent: Number(changePct.toFixed(2)),
    momentum: Number(momentum.toFixed(4)),
    sma: sma(xs, Math.min(xs.length, 5)),
    ema: Number((ema(xs, Math.min(xs.length, 5)) || 0).toFixed(4)),
    rsi14: rsi(xs),
    spikes: spikes(xs),
    direction: last > first ? 'up' : last < first ? 'down' : 'flat',
  };
}

const engine = createEngine('auto-trend-analyzer', { label: 'Auto Trend Analyzer', category: 'intelligence', work: trendWork });
module.exports = {
  name: 'auto-trend-analyzer',
  process: (input, ctx) => engine.process(input, ctx),
  analyze: (input) => trendWork(input),
  sma, ema, rsi, spikes, classify,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
