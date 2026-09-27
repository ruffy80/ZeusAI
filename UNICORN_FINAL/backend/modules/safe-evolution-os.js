'use strict';

/**
 * SECOS/1.0 — Safe Evolution Continuum
 * Permanent auto-develop / auto-innovate / auto-repair plane that is safe
 * under UNICORN_RUNTIME_PROFILE=stable.
 *
 * Does:
 *   - generate commerce innovation proposals (unicornInnovator)
 *   - evaluate + ship data/docs artifacts only (innovation-ship-gate)
 *   - scan modules + soft-repair ledger (unicornSelfHealer.observeCycle)
 *
 * Never:
 *   - rewrite backend/src/scripts (DISABLE_SELF_MUTATION stays on)
 *   - invent GMV, visitors, or social posts
 *   - PM2-restart a healthy stack (processGuardian stays off on this plane)
 *
 * Kill-switch: SAFE_EVOLVE=0
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'SECOS/1.0';
const NAME = 'safe-evolution-os';
const TICK_MS = Math.max(
  60_000,
  parseInt(process.env.SAFE_EVOLVE_TICK_MS || String(5 * 60 * 1000), 10)
);

const state = {
  armed: false,
  startedAt: null,
  ticks: 0,
  lastTickAt: null,
  lastError: null,
  last: null,
};

const _ledger = [];
let _timer = null;

function enabled() {
  return String(process.env.SAFE_EVOLVE || '1') !== '0';
}

function dataDir() {
  return process.env.SAFE_EVOLVE_DATA_DIR
    || path.join(process.env.UNICORN_COMMERCE_DIR || path.resolve(__dirname, '..', '..', 'data'), 'evolution');
}

function record(row) {
  _ledger.push(row);
  if (_ledger.length > 200) _ledger.shift();
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.appendFileSync(path.join(dataDir(), 'safe-ledger.jsonl'), JSON.stringify(row) + '\n');
  } catch (_) { /* fail-soft */ }
}

async function tick(opts = {}) {
  if (!enabled() && !(opts && opts.force)) {
    return { ok: false, reason: 'SAFE_EVOLVE=0', protocol: PROTOCOL };
  }
  state.ticks += 1;
  state.lastTickAt = new Date().toISOString();
  const out = {
    at: state.lastTickAt,
    tick: state.ticks,
    innovator: null,
    ship: null,
    healer: null,
  };

  try {
    const innovator = require('./unicornInnovator');
    if (innovator && typeof innovator.mainCycle === 'function') {
      innovator.mainCycle();
      out.innovator = innovator.getStatus ? innovator.getStatus() : { ran: true };
    }
  } catch (e) {
    out.innovator = { ok: false, error: e && e.message };
  }

  try {
    const gate = require('./innovation-ship-gate');
    const innovator = require('./unicornInnovator');
    if (gate && typeof gate.evaluateAndShip === 'function') {
      out.ship = await gate.evaluateAndShip(innovator);
    }
  } catch (e) {
    out.ship = { ok: false, error: e && e.message };
  }

  try {
    const healer = require('./unicornSelfHealer');
    if (healer && typeof healer.observeCycle === 'function') {
      out.healer = healer.observeCycle();
    } else if (healer && typeof healer.getStatus === 'function') {
      out.healer = healer.getStatus();
    }
  } catch (e) {
    out.healer = { ok: false, error: e && e.message };
  }

  state.last = {
    at: out.at,
    innovatorCycles: out.innovator && out.innovator.cycles,
    generated: out.innovator && out.innovator.generated,
    shipped: out.ship && out.ship.evaluated,
    healerCycles: out.healer && out.healer.cycles,
    modulesScanned: out.healer && out.healer.modulesScanned,
  };
  state.lastError = null;
  record({
    protocol: PROTOCOL,
    at: out.at,
    tick: state.ticks,
    inventsGmv: false,
    mutatesSource: false,
    innovator: state.last.innovatorCycles,
    generated: state.last.generated,
    shipEvaluated: state.last.shipped,
    healerCycles: state.last.healerCycles,
    modulesScanned: state.last.modulesScanned,
  });
  return { ok: true, protocol: PROTOCOL, ...out };
}

function start(opts = {}) {
  if (!enabled() && !(opts && opts.force)) {
    return { ok: false, reason: 'SAFE_EVOLVE=0', protocol: PROTOCOL };
  }
  if (process.env.NODE_ENV === 'test' && process.env.SAFE_EVOLVE_TEST !== '1' && !(opts && opts.force)) {
    return { ok: true, testSkip: true, protocol: PROTOCOL };
  }
  if (state.armed && !(opts && opts.force)) {
    return { ok: true, already: true, protocol: PROTOCOL };
  }
  state.armed = true;
  state.startedAt = state.startedAt || new Date().toISOString();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => {
    tick().catch((e) => {
      state.lastError = e && e.message;
      console.warn('[SECOS] tick failed:', state.lastError);
    });
  }, TICK_MS);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();
  setTimeout(() => { tick().catch(() => {}); }, 12_000).unref?.();
  console.log('[SECOS] Safe Evolution Continuum armed · tick every', Math.round(TICK_MS / 1000) + 's · data/artifacts only');
  return { ok: true, protocol: PROTOCOL, tickMs: TICK_MS };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  state.armed = false;
  return { ok: true, stopped: true };
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    module: NAME,
    invention: 'Safe Evolution Continuum',
    enabled: enabled(),
    armed: state.armed,
    startedAt: state.startedAt,
    ticks: state.ticks,
    lastTickAt: state.lastTickAt,
    last: state.last,
    lastError: state.lastError,
    tickMs: TICK_MS,
    mutatesSource: false,
    inventsGmv: false,
    recent: _ledger.slice(-12).reverse(),
    pledge: [
      'Runs under stable — Unicorn keeps auto-evolving without rewriting source',
      'Innovations ship as data/docs artifacts only',
      'Healer observes + ledgers; processGuardian stays off on this plane',
      'Kill-switch SAFE_EVOLVE=0',
    ],
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'tick') return tick(input);
  if (action === 'start') return start(input);
  if (action === 'stop') return stop();
  return { ok: true, action: 'status', status: getStatus() };
}

module.exports = {
  PROTOCOL,
  NAME,
  name: NAME,
  enabled,
  start,
  stop,
  tick,
  getStatus,
  process: processInput,
};
