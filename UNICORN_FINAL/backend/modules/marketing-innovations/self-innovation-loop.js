// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/self-innovation-loop.js
//
// Permanent self-innovation engine for the marketing agent. Maintains a
// registry of "viral strategies" (each = a configuration of channel,
// hook formula, CTA style, incentive type), scores them by an objective
// blend of k-factor, CTR proxy and revenue, and on every cycle:
//
//   1. Computes each strategy's score from its observation history.
//   2. Retires the bottom 10% (status='retired') so they stop being
//      promoted in the next cycle.
//   3. Mutates the top performers into N new candidate strategies
//      (genetic-style: tweak hook/CTA/channel/incentive) and inserts
//      them as 'candidate' status.
//   4. Persists a JSONL ledger of every cycle for auditability.
//
// Auto-starts on require (like autoViralGrowth) but can be disabled via
// MARKETING_INNOVATION_LOOP_DISABLED=1. Cycle interval cfg via
// MARKETING_INNOVATION_CYCLE_MS (default 60_000ms, min 5_000ms).
//
// State is in-memory; persistence is best-effort.
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const LEDGER_FILE = process.env.MARKETING_INNOVATION_LEDGER
  || path.join(DATA_DIR, 'innovation-ledger.jsonl');

const HOOK_STYLES = ['curiosity', 'fomo', 'authority', 'social-proof', 'contrarian', 'urgency', 'storytelling'];
const CTA_STYLES = ['arrow', 'imperative', 'question', 'benefit', 'low-friction'];
const INCENTIVES = ['none', 'btc-cashback', 'free-trial', 'lifetime-deal', 'referral-credit', 'unlock-feature'];
const CHANNELS = ['X', 'LinkedIn', 'Reddit', 'TikTok', 'YouTube', 'Instagram', 'Email', 'PushNotification', 'SMS', 'Facebook'];

const _strategies = new Map(); // id → strategy
const _cycles = []; // cycle history

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true }); } catch (_) {}
}
function _persist(evt) {
  try { _ensureDir(); fs.appendFileSync(LEDGER_FILE, JSON.stringify(evt) + '\n'); } catch (_) {}
}

function _id(prefix) {
  return (prefix || 'STRAT') + '-' + crypto.randomBytes(4).toString('hex');
}

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function _seedInitialStrategies() {
  if (_strategies.size > 0) return;
  // Curated, high-quality starting set.
  const seeds = [
    { channel: 'X', hookStyle: 'curiosity', ctaStyle: 'arrow', incentive: 'btc-cashback' },
    { channel: 'LinkedIn', hookStyle: 'authority', ctaStyle: 'benefit', incentive: 'free-trial' },
    { channel: 'Reddit', hookStyle: 'storytelling', ctaStyle: 'question', incentive: 'none' },
    { channel: 'Email', hookStyle: 'social-proof', ctaStyle: 'imperative', incentive: 'referral-credit' },
    { channel: 'TikTok', hookStyle: 'fomo', ctaStyle: 'low-friction', incentive: 'unlock-feature' },
    { channel: 'YouTube', hookStyle: 'contrarian', ctaStyle: 'imperative', incentive: 'lifetime-deal' },
  ];
  for (const s of seeds) addStrategy(s);
}

function addStrategy(opts) {
  const o = opts || {};
  const strategy = {
    id: _id('STRAT'),
    channel: CHANNELS.includes(o.channel) ? o.channel : _pick(CHANNELS),
    hookStyle: HOOK_STYLES.includes(o.hookStyle) ? o.hookStyle : _pick(HOOK_STYLES),
    ctaStyle: CTA_STYLES.includes(o.ctaStyle) ? o.ctaStyle : _pick(CTA_STYLES),
    incentive: INCENTIVES.includes(o.incentive) ? o.incentive : _pick(INCENTIVES),
    status: 'active',
    generation: Number(o.generation) || 0,
    parentId: o.parentId || null,
    observations: [],
    score: 0,
    createdAt: new Date().toISOString(),
  };
  _strategies.set(strategy.id, strategy);
  _persist({ type: 'add_strategy', ts: strategy.createdAt, strategy });
  return strategy;
}

/**
 * Record an outcome for a strategy.
 * obs = {kFactor?, ctr?, revenueUsd?, shares?}
 */
function observe(strategyId, obs) {
  const s = _strategies.get(String(strategyId));
  if (!s) return { ok: false, error: 'unknown_strategy' };
  const record = {
    ts: new Date().toISOString(),
    kFactor: Math.max(0, Number((obs && obs.kFactor) || 0)),
    ctr: Math.max(0, Math.min(1, Number((obs && obs.ctr) || 0))),
    revenueUsd: Math.max(0, Number((obs && obs.revenueUsd) || 0)),
    shares: Math.max(0, Number((obs && obs.shares) || 0) | 0),
  };
  s.observations.push(record);
  if (s.observations.length > 500) s.observations = s.observations.slice(-500);
  if (s.status === 'candidate') s.status = 'active';
  s.score = _scoreStrategy(s);
  return { ok: true, observation: record, score: s.score };
}

function _scoreStrategy(s) {
  if (!s.observations.length) return 0;
  const last = s.observations.slice(-50);
  const avg = (key) => last.reduce((a, b) => a + (b[key] || 0), 0) / last.length;
  const k = avg('kFactor');
  const c = avg('ctr');
  const r = avg('revenueUsd');
  const sh = avg('shares');
  // Normalize each component to ~0..1.
  const kN = Math.min(1, k / 1.5);
  const cN = c; // already 0..1
  const rN = Math.min(1, Math.log10(1 + r) / 4);
  const shN = Math.min(1, Math.log10(1 + sh) / 3);
  // Weights: k-factor dominates (compound growth), then revenue, then ctr, then shares.
  return Math.round((kN * 0.45 + rN * 0.25 + cN * 0.2 + shN * 0.1) * 1000) / 1000;
}

/**
 * Genetic mutation: tweak one or two attributes of a parent strategy.
 */
function _mutate(parent) {
  const child = {
    channel: parent.channel,
    hookStyle: parent.hookStyle,
    ctaStyle: parent.ctaStyle,
    incentive: parent.incentive,
    generation: (parent.generation || 0) + 1,
    parentId: parent.id,
  };
  const dim = _pick(['channel', 'hookStyle', 'ctaStyle', 'incentive']);
  switch (dim) {
    case 'channel': child.channel = _pick(CHANNELS); break;
    case 'hookStyle': child.hookStyle = _pick(HOOK_STYLES); break;
    case 'ctaStyle': child.ctaStyle = _pick(CTA_STYLES); break;
    case 'incentive': child.incentive = _pick(INCENTIVES); break;
  }
  // 20% chance of a second mutation.
  if (Math.random() < 0.2) {
    const dim2 = _pick(['channel', 'hookStyle', 'ctaStyle', 'incentive']);
    switch (dim2) {
      case 'channel': child.channel = _pick(CHANNELS); break;
      case 'hookStyle': child.hookStyle = _pick(HOOK_STYLES); break;
      case 'ctaStyle': child.ctaStyle = _pick(CTA_STYLES); break;
      case 'incentive': child.incentive = _pick(INCENTIVES); break;
    }
  }
  return child;
}

/**
 * Run a single innovation cycle.
 *  - Re-score every active strategy.
 *  - Retire the bottom 10% of strategies that have at least 5 observations.
 *  - Spawn N new candidate strategies from the top performers (default 3).
 */
function tick(opts) {
  const o = opts || {};
  const spawn = Math.max(1, Math.min(20, Number(o.spawn) || 3));
  const all = Array.from(_strategies.values());
  for (const s of all) if (s.status === 'active' || s.status === 'candidate') s.score = _scoreStrategy(s);

  const eligible = all.filter((s) => s.status === 'active' && s.observations.length >= 5);
  const sorted = eligible.slice().sort((a, b) => a.score - b.score);
  const retireCount = Math.floor(sorted.length * 0.1);
  const retired = [];
  for (let i = 0; i < retireCount; i++) {
    sorted[i].status = 'retired';
    sorted[i].retiredAt = new Date().toISOString();
    retired.push(sorted[i].id);
  }

  const top = sorted.slice(-3); // best 3 (last after asc sort)
  const created = [];
  for (let i = 0; i < spawn; i++) {
    const parent = top.length ? top[i % top.length] : (all[0] || null);
    if (!parent) break;
    const child = addStrategy({ ..._mutate(parent), status: 'candidate' });
    child.status = 'candidate';
    created.push(child.id);
  }

  const cycle = {
    id: 'CYC-' + crypto.randomBytes(3).toString('hex'),
    ts: new Date().toISOString(),
    totalStrategies: _strategies.size,
    activeStrategies: Array.from(_strategies.values()).filter((s) => s.status === 'active').length,
    candidateStrategies: Array.from(_strategies.values()).filter((s) => s.status === 'candidate').length,
    retired,
    spawned: created,
    topScore: sorted.length ? sorted[sorted.length - 1].score : 0,
    medianScore: sorted.length ? sorted[Math.floor(sorted.length / 2)].score : 0,
  };
  _cycles.push(cycle);
  if (_cycles.length > 500) _cycles.splice(0, _cycles.length - 500);
  _persist({ type: 'cycle', ...cycle });
  return cycle;
}

function listStrategies(opts) {
  const o = opts || {};
  const status = o.status ? String(o.status) : null;
  const limit = Math.max(1, Math.min(500, Number(o.limit) || 100));
  let arr = Array.from(_strategies.values());
  if (status) arr = arr.filter((s) => s.status === status);
  arr.sort((a, b) => b.score - a.score);
  return arr.slice(0, limit).map((s) => ({
    ...s,
    observationCount: s.observations.length,
    observations: s.observations.slice(-5),
  }));
}

function getStatus() {
  const all = Array.from(_strategies.values());
  const byStatus = all.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  const top = all.slice().sort((a, b) => b.score - a.score).slice(0, 3).map((s) => ({
    id: s.id, channel: s.channel, hookStyle: s.hookStyle, ctaStyle: s.ctaStyle, incentive: s.incentive, score: s.score, generation: s.generation,
  }));
  const lastCycle = _cycles.length ? _cycles[_cycles.length - 1] : null;
  return {
    totalStrategies: all.length,
    byStatus,
    cyclesRun: _cycles.length,
    topPerformers: top,
    lastCycle,
    intervalMs: _intervalMs,
    autoRun: !!_timer,
    generatedAt: new Date().toISOString(),
  };
}

let _timer = null;
let _intervalMs = 0;

function start(opts) {
  if (process.env.MARKETING_INNOVATION_LOOP_DISABLED === '1') return false;
  stop();
  const cfg = Math.max(5_000, parseInt((opts && opts.intervalMs) || process.env.MARKETING_INNOVATION_CYCLE_MS || '60000', 10));
  _intervalMs = cfg;
  _timer = setInterval(() => {
    try { tick(); } catch (e) { try { console.warn('[marketing-innovation-loop] tick error:', e && e.message); } catch (_) {} }
  }, cfg);
  if (typeof _timer.unref === 'function') _timer.unref();
  return true;
}
function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

function _resetForTests() {
  stop();
  _strategies.clear();
  _cycles.length = 0;
  _seedInitialStrategies();
}

// Initial seed + auto-start.
_seedInitialStrategies();
start();

// Best-effort cleanup on process exit so the final cycle ledger entry is flushed.
function _onExit() { try { stop(); } catch (_) {} }
try {
  process.once('SIGINT', _onExit);
  process.once('SIGTERM', _onExit);
  process.once('beforeExit', _onExit);
} catch (_) {}

module.exports = {
  addStrategy,
  observe,
  tick,
  listStrategies,
  getStatus,
  start,
  stop,
  _resetForTests,
  HOOK_STYLES,
  CTA_STYLES,
  INCENTIVES,
  CHANNELS,
};
