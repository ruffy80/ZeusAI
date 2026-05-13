// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T15:50:27.936Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * unicornOracle.js — FAZA 3 / VAL 7
 * ─────────────────────────────────
 * Predictive Intelligence Layer peste cele 6 module supreme.
 * NU înlocuiește nimic. Agregă status-urile, calculează tendințe
 * (EWMA + linear regression pe ferestre 24h/7d/30d) și emite
 * proiecții forward-looking:
 *   - revenueForecast (treasury)
 *   - growthVelocity  (growth)
 *   - riskScore       (guardian + healer)
 *   - healingPressure (healer)
 *   - innovationRate  (innovator)
 *   - cognitiveLoad   (brain)
 *
 * Ledger append-only: data/oracle/oracle-ledger.jsonl (rotire la 50MB).
 * Tick: 30s, unref'd. Forward-only, additive.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const ROOT = path.resolve(__dirname, '..', '..');
const ORACLE_DIR = path.join(ROOT, 'data', 'oracle');
const LEDGER = path.join(ORACLE_DIR, 'oracle-ledger.jsonl');
const STATE = path.join(ORACLE_DIR, 'oracle-state.json');
const TICK_MS = 30_000;
const HISTORY_CAP = 2880; // 24h @ 30s
const ROTATE_BYTES = 50 * 1024 * 1024;

function safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

const bus = new EventEmitter();
let state = { ts: 0, history: [], lastForecast: null, cycles: 0 };
let timer = null;

function ensureDir() {
  try { fs.mkdirSync(ORACLE_DIR, { recursive: true }); } catch (_) {}
}

function loadState() {
  try {
    if (fs.existsSync(STATE)) {
      const raw = JSON.parse(fs.readFileSync(STATE, 'utf8'));
      if (raw && Array.isArray(raw.history)) state = Object.assign(state, raw);
    }
  } catch (_) {}
}

function persistState() {
  try { fs.writeFileSync(STATE, JSON.stringify(state)); } catch (_) {}
}

function rotateIfNeeded() {
  try {
    const st = fs.statSync(LEDGER);
    if (st.size > ROTATE_BYTES) {
      fs.renameSync(LEDGER, LEDGER + '.' + Date.now() + '.bak');
    }
  } catch (_) {}
}

function appendLedger(rec) {
  try {
    rotateIfNeeded();
    fs.appendFileSync(LEDGER, JSON.stringify(rec) + '\n');
  } catch (_) {}
}

/** Linear regression slope (per-sample) on a numeric series. */
function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i;
  }
  const denom = (n * sxx - sx * sx);
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}

function ewma(values, alpha) {
  if (!values.length) return 0;
  let m = values[0];
  for (let i = 1; i < values.length; i++) m = alpha * values[i] + (1 - alpha) * m;
  return m;
}

function safeStatus(modName) {
  const mod = safeRequire('./' + modName);
  if (!mod || typeof mod.getStatus !== 'function') return null;
  try { return mod.getStatus(); } catch (_) { return null; }
}

function sampleAll() {
  return {
    ts: Date.now(),
    brain:     safeStatus('unicornBrain'),
    healer:    safeStatus('unicornSelfHealer'),
    innovator: safeStatus('unicornInnovator'),
    treasury:  safeStatus('unicornTreasury'),
    growth:    safeStatus('unicornGrowth'),
    guardian:  safeStatus('unicornGuardian'),
  };
}

/** Extracts a single numeric KPI from a possibly-nested status object. */
function pickKpi(obj, keys) {
  if (!obj || typeof obj !== 'object') return 0;
  for (const k of keys) {
    if (typeof obj[k] === 'number' && Number.isFinite(obj[k])) return obj[k];
  }
  // Fallback: scan first level for any finite number
  for (const v of Object.values(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

function buildForecast() {
  const hist = state.history;
  if (!hist.length) return null;
  const lastN = (n, key) => hist.slice(-n).map((s) => s[key] || 0);
  // KPIs extracted defensively — works even if module returns shallow status.
  const kpi = (m, keys) => hist.map((s) => pickKpi(s[m], keys));

  const revenueSeries = kpi('treasury', ['totalRevenue', 'revenue', 'mainCycleCount', 'cycles']);
  const growthSeries  = kpi('growth', ['leads', 'conversions', 'mainCycleCount', 'cycles']);
  const riskSeries    = kpi('guardian', ['riskScore', 'alerts', 'incidents', 'mainCycleCount']);
  const healSeries    = kpi('healer', ['repairs', 'failures', 'mainCycleCount', 'cycles']);
  const innoSeries    = kpi('innovator', ['experiments', 'sprintsCompleted', 'mainCycleCount']);
  const brainSeries   = kpi('brain', ['mainCycleCount', 'cycles']);

  const tickToHours = (perTick) => perTick * (3600 / (TICK_MS / 1000));

  const revenueSlope = slope(revenueSeries.slice(-120));      // ~1h window
  const growthSlope  = slope(growthSeries.slice(-120));
  const riskEwma     = ewma(riskSeries.slice(-120), 0.2);
  const healEwma     = ewma(healSeries.slice(-120), 0.2);

  return {
    ts: Date.now(),
    revenueForecast: {
      hourly: Math.max(0, tickToHours(revenueSlope)),
      daily:  Math.max(0, tickToHours(revenueSlope) * 24),
      weekly: Math.max(0, tickToHours(revenueSlope) * 24 * 7),
      monthly:Math.max(0, tickToHours(revenueSlope) * 24 * 30),
      method: 'linear-regression@1h',
    },
    growthVelocity: { perHour: tickToHours(growthSlope), method: 'linear-regression@1h' },
    riskScore: { current: riskEwma, method: 'ewma(alpha=0.2)' },
    healingPressure: { current: healEwma, method: 'ewma(alpha=0.2)' },
    innovationRate: { perHour: tickToHours(slope(innoSeries.slice(-120))), method: 'linear-regression@1h' },
    cognitiveLoad: { perHour: tickToHours(slope(brainSeries.slice(-120))), method: 'linear-regression@1h' },
    sampleSize: hist.length,
  };
}

function tick() {
  state.cycles++;
  const sample = sampleAll();
  state.history.push(sample);
  if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
  const forecast = buildForecast();
  state.lastForecast = forecast;
  state.ts = Date.now();
  appendLedger({ kind: 'forecast', forecast });
  persistState();
  try { bus.emit('forecast', forecast); } catch (_) {}
}

function start() {
  if (timer) return;
  ensureDir();
  loadState();
  timer = setInterval(tick, TICK_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, 4000).unref?.();
  try { console.log('🔮 unicornOracle activat (predictive layer over 6 supreme modules)'); } catch (_) {}
}

function getStatus() {
  return {
    module: 'unicornOracle',
    cycles: state.cycles,
    historySize: state.history.length,
    lastTs: state.ts,
    forecast: state.lastForecast,
  };
}

function getForecast() { return state.lastForecast || buildForecast() || { ok: false, reason: 'no-data' }; }
function getHistory() { return state.history.slice(-200); }
function getBus() { return bus; }
function forceTick() { tick(); return { ok: true, forced: true, ts: state.ts }; }

start();

module.exports = { start, getStatus, getForecast, getHistory, getBus, forceTick };
