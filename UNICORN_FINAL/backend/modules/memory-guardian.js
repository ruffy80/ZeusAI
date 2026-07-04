// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-12
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// memory-guardian.js — RAM pressure observer + cooperative cache trimming.
//
// Audit 2026-06-12: the Hetzner box sits at 95%+ RAM with swap active.
// Upgrading hardware is a human decision; what software CAN do safely is:
//   1. continuously measure real pressure (process RSS vs PM2 limit,
//      heap usage, system free memory),
//   2. when pressure crosses thresholds, ask registered caches to trim
//      themselves (cooperative, bounded, logged),
//   3. expose an honest /api/memory/status for dashboards + flywheel.
//
// HARD CONTRACT (golden rule 6 — resource monitor never kills backend):
//   • NEVER process.exit / kill / PM2 restart. Observation + trim ONLY.
//   • One unref()'d interval. Bounded history ring. No external deps.
// RO: gardian de memorie — observă, taie cache-uri cooperant, nu omoară
// NICIODATĂ procesul. Regula de aur 6 e contract, nu sugestie.
// =====================================================================

'use strict';

const os = require('os');

const NAME = 'memory-guardian';
const SAMPLE_INTERVAL_MS = Math.max(15000, Number(process.env.MEMORY_GUARDIAN_INTERVAL_MS || 60000));
const HISTORY_MAX = 180; // ~3h at 60s
const TRIM_COOLDOWN_MS = Math.max(60000, Number(process.env.MEMORY_GUARDIAN_TRIM_COOLDOWN_MS || 5 * 60 * 1000));

// Thresholds (overridable for tests / tuning).
const RSS_PCT_OF_LIMIT = Math.min(0.99, Number(process.env.MEMORY_GUARDIAN_RSS_PCT || 0.85));
const HEAP_PCT = Math.min(0.99, Number(process.env.MEMORY_GUARDIAN_HEAP_PCT || 0.92));
const SYSTEM_PCT = Math.min(0.99, Number(process.env.MEMORY_GUARDIAN_SYSTEM_PCT || 0.92));

function _pm2LimitBytes() {
  // ecosystem.config.js pins PM2_MAX_MEMORY (e.g. "2560M") — golden rule 7.
  const raw = String(process.env.PM2_MAX_MEMORY || '2560M').trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*([kmg])?b?$/i);
  if (!m) return 2560 * 1024 * 1024;
  const n = Number(m[1]);
  const unit = (m[2] || 'm').toLowerCase();
  const mult = unit === 'g' ? 1024 ** 3 : unit === 'k' ? 1024 : 1024 ** 2;
  return Math.round(n * mult);
}

const trimmers = new Map(); // name → fn() → { trimmed?: any }
const state = {
  startedAt: null,
  samples: [],          // ring buffer of { ts, rss, heapUsed, heapTotal, systemUsedPct }
  pressureEvents: 0,
  lastPressureAt: null,
  lastTrimAt: 0,
  trims: [],            // last 20 trim actions
};
let _interval = null;

/** Register a cooperative cache trimmer. fn must be cheap and idempotent. */
function registerTrimmer(name, fn) {
  if (!name || typeof fn !== 'function') return { ok: false, error: 'name_and_fn_required' };
  trimmers.set(String(name), fn);
  return { ok: true, registered: trimmers.size };
}

function _sample() {
  const mu = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  return {
    ts: Date.now(),
    rss: mu.rss,
    heapUsed: mu.heapUsed,
    heapTotal: mu.heapTotal,
    external: mu.external,
    systemUsedPct: total > 0 ? Math.round(((total - free) / total) * 10000) / 10000 : 0,
  };
}

function _evaluate(s) {
  const limit = _pm2LimitBytes();
  const reasons = [];
  if (s.rss > limit * RSS_PCT_OF_LIMIT) reasons.push('rss ' + Math.round(s.rss / 1048576) + 'MB > ' + Math.round(RSS_PCT_OF_LIMIT * 100) + '% of PM2 limit ' + Math.round(limit / 1048576) + 'MB');
  if (s.heapTotal > 0 && s.heapUsed / s.heapTotal > HEAP_PCT) reasons.push('heap ' + Math.round((s.heapUsed / s.heapTotal) * 100) + '% > ' + Math.round(HEAP_PCT * 100) + '%');
  if (s.systemUsedPct > SYSTEM_PCT) reasons.push('system ' + Math.round(s.systemUsedPct * 100) + '% > ' + Math.round(SYSTEM_PCT * 100) + '%');
  return reasons;
}

function _runTrimmers(reasons) {
  const now = Date.now();
  if (now - state.lastTrimAt < TRIM_COOLDOWN_MS) {
    return { ok: true, skipped: 'cooldown', nextAllowedInMs: TRIM_COOLDOWN_MS - (now - state.lastTrimAt) };
  }
  state.lastTrimAt = now;
  const results = [];
  for (const [name, fn] of trimmers.entries()) {
    try {
      const r = fn();
      results.push({ name, ok: true, result: (r && typeof r === 'object') ? r : null });
    } catch (e) {
      results.push({ name, ok: false, error: e && e.message });
    }
  }
  const action = { at: new Date(now).toISOString(), reasons, results };
  state.trims.unshift(action);
  state.trims = state.trims.slice(0, 20);
  console.warn('🧠 [' + NAME + '] memory pressure → cooperative trim (' + reasons.join('; ') + ') — ' + results.length + ' trimmers ran. NO restart, NO kill (golden rule 6).');
  return { ok: true, action };
}

/** One observation tick. Exported for tests (no timers needed). */
function tick() {
  const s = _sample();
  state.samples.push(s);
  if (state.samples.length > HISTORY_MAX) state.samples.splice(0, state.samples.length - HISTORY_MAX);
  const reasons = _evaluate(s);
  if (reasons.length > 0) {
    state.pressureEvents += 1;
    state.lastPressureAt = new Date(s.ts).toISOString();
    return { pressure: true, reasons, trim: _runTrimmers(reasons) };
  }
  return { pressure: false };
}

function start() {
  if (_interval) return { ok: true, alreadyRunning: true };
  state.startedAt = new Date().toISOString();
  _interval = setInterval(() => { try { tick(); } catch (_) {} }, SAMPLE_INTERVAL_MS);
  if (_interval.unref) _interval.unref();
  console.log('🧠 [' + NAME + '] started — sampling every ' + Math.round(SAMPLE_INTERVAL_MS / 1000) + 's, PM2 limit ' + Math.round(_pm2LimitBytes() / 1048576) + 'MB, observe+trim only (never kills — golden rule 6)');
  return { ok: true };
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  return { ok: true };
}

function getStatus() {
  const last = state.samples[state.samples.length - 1] || null;
  const limit = _pm2LimitBytes();
  return {
    module: NAME,
    running: !!_interval,
    contract: 'observe + cooperative trim only — never exits, never kills, never restarts (golden rule 6)',
    startedAt: state.startedAt,
    pm2LimitMB: Math.round(limit / 1048576),
    thresholds: { rssPctOfLimit: RSS_PCT_OF_LIMIT, heapPct: HEAP_PCT, systemPct: SYSTEM_PCT, trimCooldownMs: TRIM_COOLDOWN_MS },
    current: last ? {
      rssMB: Math.round(last.rss / 1048576),
      rssPctOfLimit: Math.round((last.rss / limit) * 10000) / 10000,
      heapUsedMB: Math.round(last.heapUsed / 1048576),
      heapPct: last.heapTotal > 0 ? Math.round((last.heapUsed / last.heapTotal) * 10000) / 10000 : 0,
      systemUsedPct: last.systemUsedPct,
      at: new Date(last.ts).toISOString(),
    } : null,
    pressureEvents: state.pressureEvents,
    lastPressureAt: state.lastPressureAt,
    registeredTrimmers: Array.from(trimmers.keys()),
    recentTrims: state.trims.slice(0, 5),
    samplesHeld: state.samples.length,
  };
}

function _resetForTests() {
  stop();
  trimmers.clear();
  state.samples = []; state.pressureEvents = 0; state.lastPressureAt = null;
  state.lastTrimAt = 0; state.trims = []; state.startedAt = null;
}

module.exports = { name: NAME, start, stop, tick, registerTrimmer, getStatus, _pm2LimitBytes, _resetForTests };
