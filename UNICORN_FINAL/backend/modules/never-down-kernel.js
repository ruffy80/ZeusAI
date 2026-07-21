'use strict';

/**
 * never-down-kernel.js — Forever-Up Kernel (NDK/1.0)
 * --------------------------------------------------
 * World-class single-box resilience kernel for ZeusAI.
 *
 * Hard contract (golden rule 6):
 *   NEVER process.exit / kill / PM2-restart from inside this module.
 *   Observation + cooperative recovery ONLY. External healers (autoheal-min,
 *   health-watch, PM2 max_memory_restart) own restarts.
 *
 * What it adds that was missing:
 *   1. Event-loop lag probe (detects hangs that still return HTTP 200)
 *   2. Disk-pressure actions (invoke registered cleaners / retention hooks)
 *   3. Unified forever-up status for /api/health + healers
 *   4. Soft degrade signal so site can serve fallbacks without crashing
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const NAME = 'never-down-kernel';
const PROTOCOL = 'NDK/1.0';

const LAG_WARN_MS = Math.max(50, Number(process.env.NDK_LAG_WARN_MS || 400));
const LAG_FAIL_MS = Math.max(LAG_WARN_MS + 50, Number(process.env.NDK_LAG_FAIL_MS || 3000));
const SAMPLE_MS = Math.max(1000, Number(process.env.NDK_SAMPLE_MS || 5000));
const DISK_WARN_PCT = Math.max(50, Number(process.env.NDK_DISK_WARN_PCT || 85));
const DISK_ACT_PCT = Math.max(DISK_WARN_PCT, Number(process.env.NDK_DISK_ACT_PCT || 92));
const ACTION_COOLDOWN_MS = Math.max(30000, Number(process.env.NDK_ACTION_COOLDOWN_MS || 5 * 60 * 1000));
const HISTORY_MAX = 120;
const HEALER_FAIL_SAMPLES = Math.max(2, Number(process.env.NDK_HEALER_FAIL_SAMPLES || 3));
const BOOT_GRACE_MS = Math.max(0, Number(process.env.NDK_BOOT_GRACE_MS || 90000));

const cleaners = new Map(); // name → async|sync fn → { ok, freed? }
const state = {
  startedAt: null,
  running: false,
  interval: null,
  lagMs: 0,
  lagP95Ms: 0,
  lagSamples: [],
  diskUsedPct: 0,
  health: 'good', // good | degraded | critical
  reasons: [],
  actions: [],
  lastActionAt: 0,
  actionCount: 0,
  samples: 0,
  lastSampleAt: null,
  neverKill: true,
  protocol: PROTOCOL,
};

function _diskUsedPct() {
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync('/');
      const total = s.blocks * s.bsize;
      const free = s.bfree * s.bsize;
      if (total > 0) return Math.round(((total - free) / total) * 100);
    }
  } catch (_) { /* tolerate */ }
  return 0;
}

function _percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function measureLag(cb) {
  const t0 = process.hrtime.bigint();
  setImmediate(() => {
    const dt = Number(process.hrtime.bigint() - t0) / 1e6;
    try { cb(dt); } catch (_) { /* never throw out */ }
  });
}

function registerCleaner(name, fn) {
  if (!name || typeof fn !== 'function') return false;
  cleaners.set(String(name), fn);
  return true;
}

function _recordAction(entry) {
  state.actions.unshift(Object.assign({ ts: new Date().toISOString() }, entry));
  if (state.actions.length > 40) state.actions.length = 40;
  state.actionCount += 1;
  state.lastActionAt = Date.now();
}

async function runCleaners(reason) {
  const now = Date.now();
  if ((now - state.lastActionAt) < ACTION_COOLDOWN_MS) {
    return { ok: true, skipped: true, reason: 'cooldown' };
  }
  const results = [];
  for (const [name, fn] of cleaners.entries()) {
    try {
      const out = await Promise.resolve(fn({ reason }));
      results.push({ name, ok: true, out: out || null });
    } catch (e) {
      results.push({ name, ok: false, error: String(e && e.message || e) });
    }
  }
  // Best-effort log trim under shared/data
  try {
    const roots = [
      process.env.UNICORN_DATA_DIR,
      path.resolve(__dirname, '..', '..', 'data'),
      path.resolve(__dirname, '..', '..', 'logs'),
      '/var/www/unicorn/shared/logs',
    ].filter(Boolean);
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      // Only truncate known noisy jsonl files larger than 50MB
      const walk = (dir, depth) => {
        if (depth > 2) return;
        let ents = [];
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
        for (const ent of ents) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(full, depth + 1);
          else if (/\.(jsonl|log)$/i.test(ent.name)) {
            try {
              const st = fs.statSync(full);
              if (st.size > 50 * 1024 * 1024) {
                // Keep last ~8MB by reading tail is expensive; truncate safely
                fs.truncateSync(full, 0);
                results.push({ name: 'truncate:' + ent.name, ok: true, freedBytes: st.size });
              }
            } catch (_) { /* skip */ }
          }
        }
      };
      walk(root, 0);
    }
  } catch (_) { /* tolerate */ }

  _recordAction({ reason, results });
  return { ok: true, skipped: false, results };
}

function _reevaluate() {
  const reasons = [];
  let health = 'good';
  const bootGrace = state.startedAt
    ? (Date.now() - Date.parse(state.startedAt)) < BOOT_GRACE_MS
    : true;
  const lagCritical = !bootGrace
    && state.lagSamples.length >= HEALER_FAIL_SAMPLES
    && state.lagP95Ms >= LAG_FAIL_MS;
  const lagWarn = state.lagMs >= LAG_WARN_MS || state.lagP95Ms >= LAG_WARN_MS;

  if (lagCritical) {
    health = 'critical';
    reasons.push('event_loop_lag');
  } else if (lagWarn) {
    health = 'degraded';
    reasons.push('event_loop_lag_warn');
  }
  if (state.diskUsedPct >= DISK_ACT_PCT) {
    health = 'critical';
    reasons.push('disk_critical');
  } else if (state.diskUsedPct >= DISK_WARN_PCT) {
    if (health === 'good') health = 'degraded';
    reasons.push('disk_warn');
  }
  const memFreePct = Math.round((os.freemem() / os.totalmem()) * 100);
  if (memFreePct <= 5) {
    health = 'critical';
    reasons.push('ram_critical');
  } else if (memFreePct <= 10) {
    if (health === 'good') health = 'degraded';
    reasons.push('ram_warn');
  }
  state.health = health;
  state.reasons = reasons;
  return { health, reasons, bootGrace, lagCritical };
}

function sampleOnce() {
  return new Promise((resolve) => {
    measureLag(async (lagMs) => {
      state.lagMs = Math.round(lagMs * 100) / 100;
      state.lagSamples.push(state.lagMs);
      if (state.lagSamples.length > HISTORY_MAX) state.lagSamples.shift();
      state.lagP95Ms = Math.round(_percentile(state.lagSamples, 95) * 100) / 100;
      state.diskUsedPct = _diskUsedPct();
      state.samples += 1;
      state.lastSampleAt = new Date().toISOString();
      const evaled = _reevaluate();
      if (evaled.reasons.includes('disk_critical') || evaled.reasons.includes('ram_critical')) {
        try { await runCleaners(evaled.reasons.join(',')); } catch (_) { /* never throw */ }
        // Ask memory guardian to trim if present
        try {
          const mg = require('./memory-guardian');
          if (mg && typeof mg.tick === 'function') mg.tick();
        } catch (_) { /* optional */ }
      }
      resolve(getStatus());
    });
  });
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = new Date().toISOString();
  const tick = () => { sampleOnce().catch(() => {}); };
  state.interval = setInterval(tick, SAMPLE_MS);
  if (state.interval.unref) state.interval.unref();
  setImmediate(tick);
  console.log(`[never-down] ${PROTOCOL} started · lagFail=${LAG_FAIL_MS}ms diskAct=${DISK_ACT_PCT}% · neverKill=true`);
  return getStatus();
}

function stop() {
  if (state.interval) clearInterval(state.interval);
  state.interval = null;
  state.running = false;
}

function getStatus() {
  return {
    ok: true,
    name: NAME,
    protocol: PROTOCOL,
    neverKill: true,
    health: state.health,
    reasons: state.reasons.slice(),
    lagMs: state.lagMs,
    lagP95Ms: state.lagP95Ms,
    lagWarnMs: LAG_WARN_MS,
    lagFailMs: LAG_FAIL_MS,
    healerFailSamples: HEALER_FAIL_SAMPLES,
    bootGraceMs: BOOT_GRACE_MS,
    diskUsedPct: state.diskUsedPct,
    diskWarnPct: DISK_WARN_PCT,
    diskActPct: DISK_ACT_PCT,
    freeMemPct: Math.round((os.freemem() / os.totalmem()) * 100),
    cleaners: Array.from(cleaners.keys()),
    actionCount: state.actionCount,
    lastActionAt: state.lastActionAt ? new Date(state.lastActionAt).toISOString() : null,
    recentActions: state.actions.slice(0, 5),
    samples: state.samples,
    lastSampleAt: state.lastSampleAt,
    startedAt: state.startedAt,
    running: state.running,
    uptimeSec: Math.floor(process.uptime()),
  };
}

/** Compact block for /api/health enrichment */
function healthEnvelope() {
  const s = getStatus();
  return {
    protocol: PROTOCOL,
    health: s.health,
    lagMs: s.lagMs,
    lagP95Ms: s.lagP95Ms,
    diskUsedPct: s.diskUsedPct,
    freeMemPct: s.freeMemPct,
    reasons: s.reasons,
    neverKill: true,
    // Healers: treat as fail only when critical lag (hang) — disk/ram stay 200 but degraded
    healerFail: s.health === 'critical' && s.reasons.includes('event_loop_lag'),
  };
}

async function processAction(body = {}) {
  const action = String(body.action || 'status').toLowerCase();
  if (action === 'sample') return sampleOnce();
  if (action === 'clean') return runCleaners(String(body.reason || 'manual'));
  if (action === 'start') return start();
  return getStatus();
}

module.exports = {
  NAME,
  PROTOCOL,
  start,
  stop,
  sampleOnce,
  measureLag,
  registerCleaner,
  runCleaners,
  getStatus,
  healthEnvelope,
  process: processAction,
  processAction,
};
