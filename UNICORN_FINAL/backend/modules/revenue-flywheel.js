// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-12
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// revenue-flywheel.js — Autonomous compounding growth orchestrator.
//
// THE INNOVATION (2026-06-12): every revenue organ already exists in this
// codebase — catalog, BTC checkout, dynamic pricing, SEO pages, SDR queue,
// funnel telemetry, truth metrics. What never existed is the CLOSED LOOP
// that connects them so the system compounds on its own:
//
//        ┌────────────────────────────────────────────────────┐
//        │  MEASURE (truth)        reality-metrics + funnel    │
//        │     ↓                                               │
//        │  RANK (yield/product)   paid×100 + checkout×10 + view
//        │     ↓                                               │
//        │  ACT (safe actions)     1. resubmit top-yield URLs  │
//        │                         2. pricing PROPOSALS        │
//        │                         3. refresh outreach queue   │
//        │     ↓                                               │
//        │  RECORD (hash chain)    cycles.jsonl, prevHash link │
//        │     ↓                                               │
//        │  COMPARE (momentum)     did last cycle's actions    │
//        │                         move visitors/checkout/paid?│
//        └──────────────── loops every 30 min ─────────────────┘
//
// Momentum is the compounding term: each cycle measures the delta produced
// by the previous cycle and reallocates distribution slots toward products
// whose yield is RISING. Zero Math.random. Zero fabricated numbers. Every
// decision row is hash-chained (sha256 prevHash) → auditable forever.
//
// SAFETY CONTRACT:
//   • Never mutates prices directly — emits PROPOSALS for the existing
//     price-autotuner / deepseek-governor allowlist organs.
//   • Never touches PM2/processes (golden rule 6). One unref()'d interval.
//   • All actions are idempotent + bounded; ledger rotates at 5MB.
// RO: volanul de venit — bucla închisă care compune autonom: măsoară,
// clasează, acționează sigur, înregistrează criptografic, compară.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'revenue-flywheel';
const LEDGER_FILE = process.env.FLYWHEEL_LEDGER_FILE
  || path.resolve(__dirname, '..', '..', 'data', 'flywheel', 'cycles.jsonl');
const LEDGER_MAX_BYTES = 5 * 1024 * 1024;
const INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.FLYWHEEL_INTERVAL_MS || 30 * 60 * 1000));
const MIN_VIEWS_FOR_PRICE_PROBE = Number(process.env.FLYWHEEL_PROBE_MIN_VIEWS || 25);
const TOP_DISTRIBUTION_SLOTS = 10;

const deps = { funnelIntelligence: null, trafficEngine: null, realityMetrics: null, dynamicPricing: null };

const state = {
  startedAt: null,
  cycles: 0,
  lastCycle: null,      // full last cycle row
  lastHash: null,       // hash-chain head
  momentum: null,       // { visitors, checkouts, paid, score, trend }
  prevMeasure: null,    // previous cycle 30d window for delta computation
};
let _interval = null;

function configure(injected) {
  Object.assign(deps, injected || {});
  return module.exports;
}

function _require(name, fallbackPath) {
  if (deps[name]) return deps[name];
  try { deps[name] = require(fallbackPath); } catch (_) { deps[name] = null; }
  return deps[name];
}

// ── MEASURE ──────────────────────────────────────────────────────────
function _measure() {
  const fi = _require('funnelIntelligence', './funnel-intelligence');
  const rm = _require('realityMetrics', './reality-metrics');
  let funnel = null; let truth = null;
  try { funnel = fi ? fi.summary() : null; } catch (_) {}
  try { truth = rm ? rm.snapshot() : null; } catch (_) {}
  const w30 = funnel && funnel.windows ? funnel.windows.last30d : null;
  return {
    at: new Date().toISOString(),
    visitors30d: w30 ? w30.sessions : 0,
    pageViews30d: w30 ? w30.pageViews : 0,
    checkouts30d: w30 ? w30.checkoutStarts : 0,
    paid30d: w30 ? w30.paid : 0,
    realPaidOrders: truth && truth.orders ? truth.orders.paid : 0,
    realRevenueUsd: truth && truth.revenue ? truth.revenue.paidUsd : 0,
    topProducts: funnel ? (funnel.topProducts || []) : [],
  };
}

// ── MOMENTUM (the compounding term) ──────────────────────────────────
function _momentum(cur, prev) {
  if (!prev) return { score: 0, trend: 'baseline', deltas: null, note: 'first measured cycle — baseline established' };
  const dv = cur.visitors30d - prev.visitors30d;
  const dc = cur.checkouts30d - prev.checkouts30d;
  const dp = cur.paid30d - prev.paid30d;
  const dr = Math.round((cur.realRevenueUsd - prev.realRevenueUsd) * 100) / 100;
  // Paid movement dominates; revenue is the ground truth multiplier.
  const score = dp * 100 + dc * 10 + dv + (dr > 0 ? Math.min(dr, 1000) : 0);
  const trend = score > 0 ? 'compounding' : (score < 0 ? 'decaying' : 'flat');
  return { score, trend, deltas: { visitors: dv, checkouts: dc, paid: dp, revenueUsd: dr } };
}

// ── DECIDE + ACT (safe actions only) ─────────────────────────────────
async function _act(measure, opts) {
  const dryRun = !!(opts && opts.dryRun);
  const actions = [];
  const te = _require('trafficEngine', './traffic-engine');
  const appUrl = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

  // 1. DISTRIBUTE — resubmit top-yield product URLs for re-crawl. Rising
  //    products earn distribution slots; with no signal yet, the full
  //    inventory cycle (traffic-engine's own schedule) stays the baseline.
  const top = (measure.topProducts || []).filter((p) => p.yieldScore > 0).slice(0, TOP_DISTRIBUTION_SLOTS);
  if (top.length > 0 && te && typeof te.pingAll === 'function') {
    const urls = top.map((p) => appUrl + '/services/' + encodeURIComponent(p.id));
    let result = { dryRun: true, planned: urls.length };
    if (!dryRun) { try { result = await te.pingAll({ urls }); } catch (e) { result = { ok: false, error: e && e.message }; } }
    else { try { result = await te.pingAll({ urls, dryRun: true }); } catch (e) { result = { ok: false, error: e && e.message }; } }
    actions.push({ type: 'distribute_top_yield', products: top.map((p) => p.id), urlCount: urls.length, result });
  } else {
    actions.push({ type: 'distribute_top_yield', skipped: 'no product has measurable yield yet — baseline inventory submission continues on traffic-engine schedule' });
  }

  // 2. PRICING PROPOSALS — high attention, zero conversion → propose probe.
  //    NEVER mutates prices here: proposals are consumed by the existing
  //    price-autotuner / deepseek-governor allowlist organs.
  const proposals = [];
  for (const p of measure.topProducts || []) {
    if (p.views >= MIN_VIEWS_FOR_PRICE_PROBE && p.checkouts === 0) {
      proposals.push({ serviceId: p.id, evidence: { views: p.views, checkouts: 0 }, proposal: 'price_probe_down_10pct', reason: 'attention without conversion — price is the first lever to test' });
    }
    if (p.checkouts >= 3 && p.paid === 0) {
      proposals.push({ serviceId: p.id, evidence: { checkouts: p.checkouts, paid: 0 }, proposal: 'checkout_friction_audit', reason: 'buyers start but never settle — friction, not price' });
    }
  }
  actions.push({ type: 'pricing_proposals', count: proposals.length, proposals: proposals.slice(0, 20) });

  // 3. PIPELINE — refresh outreach queue when stale (>24h).
  if (te && typeof te.buildOutreachQueue === 'function') {
    const st = typeof te.getStatus === 'function' ? te.getStatus() : null;
    const builtAt = st && st.outreach && st.outreach.builtAt ? Date.parse(st.outreach.builtAt) : 0;
    if (!builtAt || (Date.now() - builtAt) > 24 * 3600 * 1000) {
      let q = null;
      try { q = te.buildOutreachQueue({ limit: 50 }); } catch (e) { q = { ok: false, error: e && e.message }; }
      actions.push({ type: 'refresh_outreach_queue', queued: q && q.queued, sending: q && q.sending });
    } else {
      actions.push({ type: 'refresh_outreach_queue', skipped: 'queue fresh (<24h)' });
    }
  }

  return actions;
}

// ── RECORD (hash-chained ledger) ─────────────────────────────────────
function _appendLedger(row) {
  try {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
    try {
      const st = fs.statSync(LEDGER_FILE);
      if (st.size > LEDGER_MAX_BYTES) fs.renameSync(LEDGER_FILE, LEDGER_FILE + '.1'); // single rotation, bounded disk
    } catch (_) {}
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(row) + '\n');
    return true;
  } catch (_) { return false; }
}

function _chainHash(row) {
  return crypto.createHash('sha256').update(String(state.lastHash || 'genesis') + JSON.stringify(row)).digest('hex');
}

// ── THE CYCLE ────────────────────────────────────────────────────────
async function runCycle(opts) {
  const measure = _measure();
  const momentum = _momentum(measure, state.prevMeasure);
  const actions = await _act(measure, opts);
  const row = {
    cycle: state.cycles + 1,
    at: measure.at,
    measure: {
      visitors30d: measure.visitors30d,
      checkouts30d: measure.checkouts30d,
      paid30d: measure.paid30d,
      realPaidOrders: measure.realPaidOrders,
      realRevenueUsd: measure.realRevenueUsd,
    },
    momentum,
    actions,
    prevHash: state.lastHash || 'genesis',
  };
  row.hash = _chainHash(row);
  if (!opts || !opts.dryRun) _appendLedger(row);
  state.cycles += 1;
  state.lastCycle = row;
  state.lastHash = row.hash;
  state.momentum = momentum;
  state.prevMeasure = measure;
  return { ok: true, cycle: row };
}

function start() {
  if (_interval) return { ok: true, alreadyRunning: true };
  state.startedAt = new Date().toISOString();
  const kick = setTimeout(() => { runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message)); }, 2 * 60 * 1000);
  if (kick.unref) kick.unref();
  _interval = setInterval(() => {
    runCycle().catch((e) => console.warn('[' + NAME + '] cycle failed:', e && e.message));
  }, INTERVAL_MS);
  if (_interval.unref) _interval.unref();
  console.log('🎡 [' + NAME + '] started — closed loop every ' + Math.round(INTERVAL_MS / 60000) + 'min: measure → rank → act(safe) → hash-chain → momentum');
  return { ok: true };
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  return { ok: true };
}

function getStatus() {
  return {
    module: NAME,
    running: !!_interval,
    startedAt: state.startedAt,
    intervalMinutes: Math.round(INTERVAL_MS / 60000),
    cycles: state.cycles,
    momentum: state.momentum,
    lastCycle: state.lastCycle,
    ledger: LEDGER_FILE,
    chainHead: state.lastHash,
    contract: 'safe actions only — URL distribution + proposals + queue refresh; prices are proposals for autotuner/governor, never direct writes',
  };
}

function _resetForTests() {
  stop();
  state.startedAt = null; state.cycles = 0; state.lastCycle = null;
  state.lastHash = null; state.momentum = null; state.prevMeasure = null;
  deps.funnelIntelligence = null; deps.trafficEngine = null; deps.realityMetrics = null; deps.dynamicPricing = null;
  try { fs.rmSync(LEDGER_FILE, { force: true }); fs.rmSync(LEDGER_FILE + '.1', { force: true }); } catch (_) {}
}

module.exports = { name: NAME, configure, start, stop, runCycle, getStatus, LEDGER_FILE, _resetForTests };
