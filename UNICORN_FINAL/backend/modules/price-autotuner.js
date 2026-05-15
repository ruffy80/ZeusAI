// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.377Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// UNICORN_FINAL/backend/modules/price-autotuner.js
//
// Daily ±5% price auto-tuner — runs once every 24h, looks at conversion
// signals (orders, attempts) and nudges each service's basePrice up (+5%)
// when conversion is high, down (-5%) when it's low, neutral otherwise.
//
// Persists state to data/price-autotuner.json so restarts don't reset the
// learned offsets. Honors a hard ceiling (max 2x of seed) and a floor
// (min 0.25x of seed) to avoid runaway feedback.
//
// Romanian / English bilingual comments — păstrate (regula #10).

'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.resolve(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(STATE_DIR, 'price-autotuner.json');

const TICK_MS = 24 * 60 * 60 * 1000;      // 24h — o data pe zi
const ADJUST_PCT = 0.05;                  // ±5% per zi
const FLOOR_MULT = 0.25;                  // minim 25% din seed
const CEIL_MULT = 2.0;                    // maxim 200% din seed
const HIGH_CONV = 0.06;                   // > 6% conv → +5%
const LOW_CONV = 0.01;                    // < 1% conv → -5%

let pricer = null;
let orderStore = null;
let attemptStore = null;
let timer = null;
let state = { seeds: {}, multipliers: {}, lastRunIso: null, runs: 0 };

function safeReadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') state = Object.assign(state, parsed);
  } catch (e) {
    console.warn('[price-autotuner] could not read state:', e.message);
  }
}

function safeWriteState() {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('[price-autotuner] could not write state:', e.message);
  }
}

// Compute a conversion ratio for a service id. We use:
//   conv = paidOrders / max(attempts, 1)
// Both numbers come from optional in-memory stores passed at start().
function conversionFor(serviceId) {
  let paid = 0;
  let attempts = 0;
  try {
    if (orderStore && typeof orderStore.getRecent === 'function') {
      const list = orderStore.getRecent(24 * 60 * 60 * 1000) || [];
      for (const o of list) {
        if (!o || o.serviceId !== serviceId) continue;
        attempts++;
        if (o.status === 'paid' || o.paid === true) paid++;
      }
    }
    if (attemptStore && typeof attemptStore.countAttempts === 'function') {
      attempts = Math.max(attempts, Number(attemptStore.countAttempts(serviceId, 24 * 60 * 60 * 1000)) || 0);
    }
  } catch (_) {}
  if (attempts <= 0) return null; // semnal absent → nu modificăm
  return paid / attempts;
}

function tuneOnce() {
  if (!pricer || !pricer.BASE_PRICES || typeof pricer.registerService !== 'function') {
    console.warn('[price-autotuner] dynamic-pricing module not available, skipping tick');
    return { adjusted: 0, total: 0 };
  }

  const ids = Object.keys(pricer.BASE_PRICES);
  let adjusted = 0;

  for (const id of ids) {
    const current = Number(pricer.BASE_PRICES[id]);
    if (!Number.isFinite(current) || current <= 0) continue;

    // Seed (preț inițial) memorat la prima vizitare
    if (state.seeds[id] == null) state.seeds[id] = current;
    if (state.multipliers[id] == null) state.multipliers[id] = 1.0;

    const conv = conversionFor(id);
    if (conv == null) continue; // fără date → fără modificare

    let mult = state.multipliers[id];
    if (conv >= HIGH_CONV) mult = Math.min(CEIL_MULT, mult * (1 + ADJUST_PCT));
    else if (conv <= LOW_CONV) mult = Math.max(FLOOR_MULT, mult * (1 - ADJUST_PCT));
    else continue;

    state.multipliers[id] = mult;
    const newBase = state.seeds[id] * mult;
    if (Math.abs(newBase - current) / current >= 0.001) {
      pricer.registerService(id, newBase, { force: true });
      adjusted++;
      console.log(`[price-autotuner] ${id}: conv=${(conv * 100).toFixed(2)}% → base $${current.toFixed(2)} → $${newBase.toFixed(2)} (×${mult.toFixed(3)})`);
    }
  }

  state.lastRunIso = new Date().toISOString();
  state.runs = (state.runs || 0) + 1;
  safeWriteState();
  return { adjusted, total: ids.length };
}

function start(opts = {}) {
  pricer = opts.pricer || (() => { try { return require('./dynamic-pricing'); } catch (_) { return null; } })();
  orderStore = opts.orderStore || null;
  attemptStore = opts.attemptStore || null;
  if (!pricer) {
    console.warn('[price-autotuner] dynamic-pricing missing, autotuner disabled');
    return false;
  }
  safeReadState();
  // Run once at boot (cheap if no data), then every 24h
  setTimeout(tuneOnce, 60 * 1000).unref?.();
  if (timer) clearInterval(timer);
  timer = setInterval(tuneOnce, TICK_MS);
  if (timer.unref) timer.unref();
  console.log('[price-autotuner] active · every 24h · ±5% adjust · floor x0.25 / ceil x2.0');
  return true;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

function getStatus() {
  return {
    runs: state.runs || 0,
    lastRunIso: state.lastRunIso,
    services: Object.keys(state.multipliers).length,
    multipliers: state.multipliers,
    config: { adjustPct: ADJUST_PCT, floorMult: FLOOR_MULT, ceilMult: CEIL_MULT, highConv: HIGH_CONV, lowConv: LOW_CONV, tickMs: TICK_MS },
  };
}

module.exports = { start, stop, tuneOnce, getStatus };
