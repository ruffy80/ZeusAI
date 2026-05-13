// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T15:50:27.683Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * unicornEconomy.js — FAZA 3 / VAL 8
 * ──────────────────────────────────
 * Global Profit Optimizer — overlay non-invaziv peste treasury+growth+guardian+oracle.
 * Calculează la fiecare tick:
 *   - capitalAllocation   (% recomandat: marketing / R&D / reserve / payouts)
 *   - pricingRecommendation (multiplicator dinamic 0.85–1.25)
 *   - riskBudget          (capital la risc admisibil)
 *   - profitMargin        (estimat din revenue forecast vs cost signals)
 *   - economyPulse        (compozit 0-100 — health economic global)
 *
 * NU modifică pricing-ul live. Doar publică recomandări pe event bus
 * pe care engine-urile pot subscribe (opt-in). Forward-only.
 *
 * Ledger: data/economy/economy-ledger.jsonl
 * Tick: 60s, unref'd.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'economy');
const LEDGER = path.join(DIR, 'economy-ledger.jsonl');
const STATE_FILE = path.join(DIR, 'economy-state.json');
const TICK_MS = 60_000;
const ROTATE_BYTES = 50 * 1024 * 1024;

function safeRequire(rel) { try { return require(rel); } catch (_) { return null; } }
const bus = new EventEmitter();
let state = { ts: 0, cycles: 0, last: null };
let timer = null;

function ensureDir() { try { fs.mkdirSync(DIR, { recursive: true }); } catch (_) {} }
function loadState() {
  try { if (fs.existsSync(STATE_FILE)) state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch (_) {}
}
function persistState() { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (_) {} }
function rotateIfNeeded() { try { const st = fs.statSync(LEDGER); if (st.size > ROTATE_BYTES) fs.renameSync(LEDGER, LEDGER + '.' + Date.now() + '.bak'); } catch (_) {} }
function appendLedger(rec) { try { rotateIfNeeded(); fs.appendFileSync(LEDGER, JSON.stringify(rec) + '\n'); } catch (_) {} }

function safeCall(modName, method) {
  const mod = safeRequire('./' + modName);
  if (!mod || typeof mod[method] !== 'function') return null;
  try { return mod[method](); } catch (_) { return null; }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function computeRecommendation() {
  const oracle  = safeCall('unicornOracle', 'getForecast') || {};
  const treas   = safeCall('unicornTreasury', 'getStatus') || {};
  const growth  = safeCall('unicornGrowth', 'getStatus') || {};
  const guard   = safeCall('unicornGuardian', 'getStatus') || {};
  const healer  = safeCall('unicornSelfHealer', 'getStatus') || {};

  const revenueForecastDaily = (oracle.revenueForecast && oracle.revenueForecast.daily) || 0;
  const growthVelocity = (oracle.growthVelocity && oracle.growthVelocity.perHour) || 0;
  const riskScore = (oracle.riskScore && oracle.riskScore.current) || 0;
  const healingPressure = (oracle.healingPressure && oracle.healingPressure.current) || 0;

  // Risk-adjusted dynamic allocation (sum = 100)
  const riskNorm = clamp(riskScore / 100, 0, 1);
  const reserve = Math.round(15 + 25 * riskNorm);            // 15–40%
  const marketing = Math.round(25 + 15 * (1 - riskNorm));    // 25–40%
  const rd = Math.round(15 + 10 * (1 - riskNorm));            // 15–25%
  const payouts = clamp(100 - reserve - marketing - rd, 5, 60);

  // Pricing: positive growth & low risk → uplift; high risk → discount
  const pricingMult = clamp(
    1 + 0.10 * Math.tanh(growthVelocity / 10) - 0.15 * Math.tanh(riskScore / 50),
    0.85, 1.25
  );

  // Profit margin estimate: revenue forecast minus assumed 35% baseline cost
  const profitMargin = clamp(0.65 - 0.005 * riskScore - 0.002 * healingPressure, 0.2, 0.8);

  // Composite economy pulse 0-100
  const pulse = clamp(Math.round(
    50
    + 20 * Math.tanh((revenueForecastDaily) / 10000)
    + 15 * Math.tanh(growthVelocity / 10)
    - 25 * Math.tanh(riskScore / 50)
    - 10 * Math.tanh(healingPressure / 20)
  ), 0, 100);

  // Risk budget — max % of forecasted daily revenue exposable
  const riskBudgetPct = clamp(30 - riskScore * 0.4, 5, 30);

  return {
    ts: Date.now(),
    capitalAllocation: { reserve, marketing, rd, payouts, unit: 'percent' },
    pricingRecommendation: { multiplier: Number(pricingMult.toFixed(4)), confidence: clamp(1 - riskNorm, 0.1, 1) },
    profitMargin: Number(profitMargin.toFixed(4)),
    riskBudget: { pctOfDailyRevenue: Number(riskBudgetPct.toFixed(2)) },
    economyPulse: pulse,
    inputs: {
      revenueForecastDaily,
      growthVelocity,
      riskScore,
      healingPressure,
      treasuryCycles: treas.mainCycleCount || treas.cycles || 0,
      growthCycles: growth.mainCycleCount || growth.cycles || 0,
      guardianCycles: guard.mainCycleCount || guard.cycles || 0,
      healerCycles: healer.mainCycleCount || healer.cycles || 0,
    },
  };
}

function tick() {
  state.cycles++;
  const rec = computeRecommendation();
  state.last = rec;
  state.ts = rec.ts;
  appendLedger({ kind: 'pulse', rec });
  persistState();
  try { bus.emit('pulse', rec); } catch (_) {}
}

function start() {
  if (timer) return;
  ensureDir();
  loadState();
  timer = setInterval(tick, TICK_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, 6000).unref?.();
  try { console.log('💎 unicornEconomy activat (global profit optimizer overlay)'); } catch (_) {}
}

function getStatus() {
  return { module: 'unicornEconomy', cycles: state.cycles, lastTs: state.ts, pulse: state.last };
}
function getPulse() { return state.last || computeRecommendation(); }
function getBus() { return bus; }
function forceTick() { tick(); return { ok: true, forced: true, ts: state.ts }; }

start();

module.exports = { start, getStatus, getPulse, getBus, forceTick };
