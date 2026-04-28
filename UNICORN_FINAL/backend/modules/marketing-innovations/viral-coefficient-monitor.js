// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/viral-coefficient-monitor.js
//
// Watchdog that observes the rolling k-factor (via `attribution`) and,
// when it drops under `K_FLOOR` for `WINDOW_OBS` consecutive samples,
// triggers an accelerated mutation cycle on `self-innovation-loop`.
// =====================================================================

'use strict';

const attribution = require('./attribution');
const innovationLoop = require('./self-innovation-loop');

const DISABLED = process.env.MARKETING_VIRAL_MONITOR_DISABLED === '1';
const K_FLOOR = Number(process.env.MARKETING_VIRAL_K_FLOOR || 1.0);
const WINDOW_OBS = Math.max(2, Number(process.env.MARKETING_VIRAL_WINDOW || 3));
const TICK_MS = Math.max(5_000, Number(process.env.MARKETING_VIRAL_MONITOR_TICK_MS) || 120_000);

const _samples = []; // {ts, k}
let _timer = null;
let _alerts = 0;
let _accelerations = 0;

function sampleNow() {
  let k = 0;
  try {
    const f = attribution.kFactor({}); // uses default heuristic
    k = Number((f && f.kFactor) || 0);
  } catch (_) {}
  const sample = { ts: new Date().toISOString(), k };
  _samples.push(sample);
  if (_samples.length > 200) _samples.shift();
  return sample;
}

function evaluate() {
  if (_samples.length < WINDOW_OBS) return { triggered: false, reason: 'not_enough_samples' };
  const recent = _samples.slice(-WINDOW_OBS);
  const allLow = recent.every((s) => s.k < K_FLOOR);
  if (!allLow) return { triggered: false, reason: 'k_above_floor', samples: recent };
  _alerts += 1;
  let cycle = null;
  try { cycle = innovationLoop.tick({ spawn: 6 }); _accelerations += 1; } catch (_) {}
  return { triggered: true, accelerated: !!cycle, cycle };
}

function tick() {
  if (DISABLED) return { skipped: true };
  sampleNow();
  return evaluate();
}

function start() {
  if (DISABLED || _timer) return;
  _timer = setInterval(() => { try { tick(); } catch (_) {} }, TICK_MS);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }

function status() {
  return {
    disabled: DISABLED,
    kFloor: K_FLOOR,
    windowObs: WINDOW_OBS,
    samples: _samples.length,
    lastK: _samples.length ? _samples[_samples.length - 1].k : null,
    alerts: _alerts,
    accelerations: _accelerations,
    timerActive: !!_timer,
  };
}
function _resetForTests() { _samples.length = 0; _alerts = 0; _accelerations = 0; stop(); }

if (!DISABLED) start();

module.exports = { tick, sampleNow, evaluate, start, stop, status, _resetForTests };
