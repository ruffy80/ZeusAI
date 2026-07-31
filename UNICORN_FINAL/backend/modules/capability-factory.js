'use strict';

/**
 * capability-factory.js — shared lifecycle for orchestrated Unicorn capabilities.
 * Honesty: never claims AGI / quantum internet / neural implants are live.
 * Role: observe + tick + recommend; restarts owned by external healers.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

function isoNow() {
  return new Date().toISOString();
}

function createCapability(spec) {
  const state = {
    running: false,
    startedAt: null,
    ticks: 0,
    lastTickAt: null,
    lastSense: null,
    lastProcessAt: null,
    lastProcessResult: null,
    errors: 0,
    interval: null,
  };

  const NAME = spec.id;
  const PROTOCOL = spec.protocol || 'OCC/1.0';
  // Read env via globalThis — a local `process()` method must never shadow Node's process.
  const envTick = globalThis.process && globalThis.process.env
    ? globalThis.process.env.OCC_TICK_MS
    : undefined;
  const TICK_MS = Math.max(15000, Number(spec.tickMs || envTick || 60000));

  function sense() {
    try {
      const out = typeof spec.sense === 'function' ? spec.sense(state) : { ok: true };
      state.lastSense = Object.assign({ at: isoNow() }, out || {});
      return state.lastSense;
    } catch (e) {
      state.errors += 1;
      state.lastSense = { ok: false, error: e.message, at: isoNow() };
      return state.lastSense;
    }
  }

  function tick() {
    state.ticks += 1;
    state.lastTickAt = isoNow();
    return sense();
  }

  function start() {
    if (state.running) return getStatus();
    state.running = true;
    state.startedAt = state.startedAt || isoNow();
    tick();
    state.interval = setInterval(() => {
      try { tick(); } catch (_) { /* never throw */ }
    }, TICK_MS);
    if (state.interval.unref) state.interval.unref();
    return getStatus();
  }

  function stop() {
    state.running = false;
    if (state.interval) {
      try { clearInterval(state.interval); } catch (_) { /* ok */ }
      state.interval = null;
    }
    return getStatus();
  }

  function getStatus() {
    return {
      ok: state.running && !(state.lastSense && state.lastSense.ok === false),
      protocol: PROTOCOL,
      module: NAME,
      invention: spec.title,
      running: !!state.running,
      startedAt: state.startedAt,
      ticks: state.ticks,
      lastTickAt: state.lastTickAt,
      horizonYear: spec.year || null,
      role: spec.role,
      sense: state.lastSense,
      errors: state.errors,
      honesty: {
        claimsAgi: false,
        claimsQuantumInternet: false,
        claimsNeuralImplant: false,
        inventsUptime: false,
        stubTheater: false,
        note: spec.honestyNote
          || 'Autonomous observe/tick continuum — not a claim of science-fiction hardware.',
      },
      timestamp: isoNow(),
    };
  }

  async function runProcess(data) {
    const body = data && typeof data === 'object' ? data : {};
    const sensed = sense();
    const result = {
      ok: true,
      protocol: PROTOCOL,
      module: NAME,
      status: state.running ? 'running' : 'idle',
      role: spec.role,
      sense: sensed,
      inputKeys: Object.keys(body).slice(0, 20),
      message: spec.processMessage || 'Capability processed observe cycle',
      honesty: getStatus().honesty,
      at: isoNow(),
    };
    if (typeof spec.onProcess === 'function') {
      try {
        Object.assign(result, await spec.onProcess(body, sensed, state) || {});
      } catch (e) {
        state.errors += 1;
        result.ok = false;
        result.error = e.message;
      }
    }
    state.lastProcessAt = isoNow();
    state.lastProcessResult = { ok: result.ok, at: state.lastProcessAt };
    return result;
  }

  function heal() {
    state.errors = 0;
    tick();
    return { ok: true, healed: true, module: NAME, at: isoNow() };
  }

  // UEE-compat alias
  async function init() {
    return start();
  }

  return {
    NAME,
    PROTOCOL,
    name: spec.title,
    year: spec.year,
    impact: spec.impact || 'observe',
    start,
    stop,
    init,
    getStatus,
    process: runProcess,
    heal,
    tick,
    sense,
  };
}

/** Shared host sense used by space/neural/quantum-channel capabilities */
function hostPlaneSense() {
  const mem = os.totalmem() || 1;
  const free = os.freemem() || 0;
  const freeMemPct = Math.round((free / mem) * 100);
  let diskUsedPct = null;
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync('/');
      const total = s.blocks * s.bsize;
      const avail = s.bfree * s.bsize;
      if (total > 0) diskUsedPct = Math.round(((total - avail) / total) * 100);
    }
  } catch (_) { /* ok */ }
  return {
    ok: true,
    freeMemPct,
    diskUsedPct,
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    uptimeSec: Math.round(process.uptime()),
  };
}

function foreverKeySense() {
  const env = (globalThis.process && globalThis.process.env) || {};
  const candidates = [
    env.SITE_SIGN_PEM,
    env.SITE_SIGN_KEY,
    '/var/www/unicorn/shared/site-sign.pem',
  ].filter(Boolean);
  let present = false;
  for (const p of candidates) {
    try {
      if (String(p).includes('BEGIN')) { present = true; break; }
      if (fs.existsSync(p)) { present = true; break; }
    } catch (_) { /* next */ }
  }
  if (global.__SITE_SIGN_KEY__) present = true;
  return { ok: true, foreverKeyPresent: present };
}

module.exports = {
  createCapability,
  hostPlaneSense,
  foreverKeySense,
  isoNow,
  dataRoot() {
    const env = (globalThis.process && globalThis.process.env) || {};
    return env.UNICORN_DATA_DIR
      || path.resolve(__dirname, '..', '..', 'data');
  },
};
