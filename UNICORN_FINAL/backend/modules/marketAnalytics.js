// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// marketAnalytics.js — Market / demand analytics for commerce.
//
// Aggregates simple demand signals per product category so the rest of the
// platform (pricing, catalog ordering, marketing) can react to which
// categories are trending. Fully offline and deterministic: a tick applies a
// mild exponential decay to every category score so trends fade unless
// reinforced by observed signals.
//
// Public surface: { getStatus, process, start, stop }. Safe to drive on a 60s
// heartbeat in-process or via the standalone PM2 autonomous runner.

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'market-analytics');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Baseline commerce categories tracked out of the box. New categories can be
// introduced dynamically via an observed signal (see _applySignal).
const BASE_CATEGORIES = [
  'ai-services',
  'saas',
  'dropshipping',
  'automation',
  'analytics',
  'security',
  'infrastructure',
];

const DECAY = 0.98; // per-tick multiplicative decay applied to demand scores

function _defaultState() {
  const demand = {};
  for (const c of BASE_CATEGORIES) demand[c] = 0;
  return {
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ticks: 0,
    signals: 0,
    demand, // { category: score }
    history: [], // capped list of { ts, top }
  };
}

function _loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const merged = { ..._defaultState(), ...parsed };
      merged.demand = { ..._defaultState().demand, ...(parsed.demand || {}) };
      return merged;
    }
  } catch (_) { /* cold start */ }
  return _defaultState();
}

function _saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (_) {
    return false;
  }
}

let _state = _loadState();
let _timer = null;

function _clampWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(100, n));
}

// Record demand for a category. Unknown categories are created on the fly so
// the analytics surface can grow with the catalog.
function _applySignal(category, weight) {
  const key = String(category || '').trim().toLowerCase();
  if (!key) return false;
  const w = _clampWeight(weight);
  _state.demand[key] = Math.round(((_state.demand[key] || 0) + w) * 100) / 100;
  _state.signals += 1;
  return true;
}

function _rankings() {
  return Object.entries(_state.demand)
    .map(([category, sc]) => ({ category, score: Math.round(Number(sc) * 100) / 100 }))
    .sort((a, b) => b.score - a.score);
}

function tick() {
  // Apply decay so stale demand fades unless reinforced.
  for (const key of Object.keys(_state.demand)) {
    const decayed = Number(_state.demand[key]) * DECAY;
    _state.demand[key] = decayed < 0.01 ? 0 : Math.round(decayed * 100) / 100;
  }
  _state.ticks += 1;
  _state.updatedAt = new Date().toISOString();
  const ranked = _rankings();
  _state.history.push({ ts: _state.updatedAt, top: ranked.slice(0, 3).map((r) => r.category) });
  if (_state.history.length > 200) _state.history = _state.history.slice(-200);
  _saveState(_state);
  return { ok: true, action: 'tick', ticks: _state.ticks, top: ranked.slice(0, 5) };
}

function report() {
  const ranked = _rankings();
  const total = ranked.reduce((a, r) => a + r.score, 0);
  return {
    ok: true,
    action: 'report',
    generatedAt: new Date().toISOString(),
    categories: ranked.length,
    totalDemand: Math.round(total * 100) / 100,
    rankings: ranked,
    signals: _state.signals,
    ticks: _state.ticks,
  };
}

function top(n = 5) {
  const limit = Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 5;
  return { ok: true, action: 'top', top: _rankings().slice(0, limit) };
}

function getStatus() {
  const ranked = _rankings();
  return {
    module: 'marketAnalytics',
    name: 'Market & Demand Analytics',
    status: 'active',
    ticks: _state.ticks,
    signals: _state.signals,
    trackedCategories: ranked.length,
    top: ranked.slice(0, 5),
    createdAt: _state.createdAt,
    updatedAt: _state.updatedAt,
  };
}

// NOTE: named runAction (not `process`) to avoid shadowing Node's global
// `process` object inside this module scope. Exported below as `process`.
async function runAction(input = {}) {
  const action = (input && input.action) || 'tick';
  switch (action) {
    case 'tick':
      return tick();
    case 'report':
      return report();
    case 'top':
      return top(input.n);
    case 'signal': {
      // Accept either { category, weight } or { signals: [{category, weight}] }.
      let applied = 0;
      if (Array.isArray(input.signals)) {
        for (const s of input.signals) {
          if (s && _applySignal(s.category, s.weight)) applied += 1;
        }
      } else if (input.category) {
        if (_applySignal(input.category, input.weight)) applied += 1;
      }
      _saveState(_state);
      return { ok: true, action: 'signal', applied, top: _rankings().slice(0, 5) };
    }
    case 'status':
      return getStatus();
    default:
      return { ok: false, error: `unknown action: ${action}`, supported: ['tick', 'report', 'top', 'signal', 'status'] };
  }
}

function start(opts = {}) {
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 60_000;
  tick();
  if (!_timer) {
    _timer = setInterval(() => {
      try { tick(); } catch (_) { /* keep alive */ }
    }, intervalMs);
    if (typeof _timer.unref === 'function') _timer.unref();
  }
  return { applied: false, started: true, intervalMs, status: getStatus() };
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  return { stopped: true };
}

module.exports = {
  name: 'marketAnalytics',
  getStatus,
  process: runAction,
  report,
  top,
  tick,
  start,
  stop,
  BASE_CATEGORIES,
};
