// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-12
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// funnel-intelligence.js — Durable, truthful funnel aggregation.
//
// Problem solved (audit 2026-06-12): /api/analytics/funnel kept only a
// 1000-event in-memory ring → every PM2 reload erased visitor history and
// reality-metrics reported funnel.visitors = null forever.
//
// This module is the durable brain behind that endpoint:
//   record(evt)   — classify + aggregate a funnel event (page_view,
//                   view_service, checkout_start, checkout_paid, …)
//   summary()     — daily buckets, per-product yield, conversion rates
//   visitors()    — unique sessions today / 7d / 30d (REAL, not null)
//
// Design constraints (RAM is precious on this box — golden rule 7):
//   • Bounded memory: per-day session sets capped, days pruned at 90.
//   • Debounced flush to a single JSON file (no append-forever JSONL).
//   • No timers except one unref()'d flush debounce. No Math.random KPIs.
// RO: agregare durabilă de funnel — vizitatori reali, nu null, nu inventat.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'funnel-intelligence';
const STORE_FILE = process.env.FUNNEL_INTEL_FILE
  || path.resolve(__dirname, '..', '..', 'data', 'funnel', 'funnel-intelligence.json');
const MAX_DAYS = 90;                 // prune anything older
const MAX_SESSIONS_PER_DAY = 50000;  // hard memory bound per day bucket
const MAX_PRODUCTS = 500;            // bound per-product map
const FLUSH_DEBOUNCE_MS = 5000;

// Canonical stage mapping — every alias the site/client ever used.
// RO: orice alias istoric de eveniment e mapat la o etapă canonică.
const STAGE_ALIASES = {
  page_view: 'page_view',
  view: 'page_view',
  view_service: 'product_view',
  service_view: 'product_view',
  product_view: 'product_view',
  checkout_start: 'checkout_start',
  checkout_init: 'checkout_start',
  checkout_redirect: 'checkout_start',
  checkout_confirm: 'checkout_confirm',
  checkout_paid: 'paid',
  paid: 'paid',
};

// state.days[YYYY-MM-DD] = { pageViews, productViews, checkoutStarts, paid,
//                            sessions:Set|number, revenueUsd }
// state.products[id]     = { views, checkouts, paid, revenueUsd, lastSeen }
const state = { days: {}, products: {}, totalEvents: 0, loadedAt: null };
let _flushTimer = null;
let _dirty = false;

function _dayKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function _ensureDay(key) {
  if (!state.days[key]) {
    state.days[key] = { pageViews: 0, productViews: 0, checkoutStarts: 0, paid: 0, revenueUsd: 0, sessions: new Set() };
    _pruneDays();
  }
  return state.days[key];
}

function _pruneDays() {
  const keys = Object.keys(state.days).sort();
  while (keys.length > MAX_DAYS) {
    const oldest = keys.shift();
    delete state.days[oldest];
  }
  // Compress session sets for every day except today (count only → RAM bound).
  const today = _dayKey();
  for (const k of keys) {
    if (k !== today && state.days[k] && state.days[k].sessions instanceof Set) {
      state.days[k].sessions = state.days[k].sessions.size;
    }
  }
}

function _sessionCount(day) {
  if (!day) return 0;
  return day.sessions instanceof Set ? day.sessions.size : Number(day.sessions || 0);
}

/** Record one funnel event. Safe to call from any handler — never throws. */
function record(evt) {
  try {
    if (!evt || typeof evt !== 'object') return { ok: false, error: 'event_required' };
    const stage = STAGE_ALIASES[String(evt.event || evt.stage || '').toLowerCase()];
    if (!stage) return { ok: false, error: 'unknown_stage' };
    const day = _ensureDay(_dayKey(evt.ts));
    const sessionId = evt.sessionId ? String(evt.sessionId).slice(0, 64) : null;
    if (sessionId && day.sessions instanceof Set && day.sessions.size < MAX_SESSIONS_PER_DAY) {
      day.sessions.add(sessionId);
    }
    if (stage === 'page_view') day.pageViews += 1;
    if (stage === 'product_view') day.productViews += 1;
    if (stage === 'checkout_start') day.checkoutStarts += 1;
    if (stage === 'paid') {
      day.paid += 1;
      const v = Number(evt.value || evt.amountUsd || 0);
      if (Number.isFinite(v) && v > 0) day.revenueUsd = Math.round((day.revenueUsd + v) * 100) / 100;
    }
    const pid = evt.serviceId || evt.productId ? String(evt.serviceId || evt.productId).slice(0, 120) : null;
    if (pid && stage !== 'page_view') {
      if (!state.products[pid] && Object.keys(state.products).length >= MAX_PRODUCTS) {
        // bound: drop the least recently seen product
        let lruId = null; let lruTs = Infinity;
        for (const [id, p] of Object.entries(state.products)) {
          if ((p.lastSeen || 0) < lruTs) { lruTs = p.lastSeen || 0; lruId = id; }
        }
        if (lruId) delete state.products[lruId];
      }
      const p = state.products[pid] || (state.products[pid] = { views: 0, checkouts: 0, paid: 0, revenueUsd: 0, lastSeen: 0 });
      if (stage === 'product_view') p.views += 1;
      if (stage === 'checkout_start') p.checkouts += 1;
      if (stage === 'paid') {
        p.paid += 1;
        const v = Number(evt.value || evt.amountUsd || 0);
        if (Number.isFinite(v) && v > 0) p.revenueUsd = Math.round((p.revenueUsd + v) * 100) / 100;
      }
      p.lastSeen = Date.now();
    }
    state.totalEvents += 1;
    _scheduleFlush();
    return { ok: true, stage };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function _windowTotals(daysBack) {
  const cutoff = Date.now() - daysBack * 24 * 3600 * 1000;
  let pageViews = 0, productViews = 0, checkoutStarts = 0, paid = 0, revenueUsd = 0, sessions = 0;
  for (const [key, d] of Object.entries(state.days)) {
    if (Date.parse(key + 'T00:00:00Z') < cutoff) continue;
    pageViews += d.pageViews; productViews += d.productViews;
    checkoutStarts += d.checkoutStarts; paid += d.paid; revenueUsd += d.revenueUsd;
    sessions += _sessionCount(d);
  }
  return { pageViews, productViews, checkoutStarts, paid, revenueUsd: Math.round(revenueUsd * 100) / 100, sessions };
}

/** Unique visitors (sessions) — the number reality-metrics was missing. */
function visitors() {
  const today = state.days[_dayKey()];
  return {
    today: _sessionCount(today),
    last7d: _windowTotals(7).sessions,
    last30d: _windowTotals(30).sessions,
    pageViews30d: _windowTotals(30).pageViews,
    source: 'funnel-intelligence (durable sessions, sendBeacon page_view)',
  };
}

/** Per-product yield ranking — the demand signal the flywheel consumes. */
function productYield(limit) {
  const rows = Object.entries(state.products).map(([id, p]) => ({
    id,
    views: p.views,
    checkouts: p.checkouts,
    paid: p.paid,
    revenueUsd: p.revenueUsd,
    // Evidence-weighted score: a paid order is worth 100 views.
    yieldScore: p.paid * 100 + p.checkouts * 10 + p.views,
    viewToCheckout: p.views > 0 ? Math.round((p.checkouts / p.views) * 10000) / 10000 : 0,
    checkoutToPaid: p.checkouts > 0 ? Math.round((p.paid / p.checkouts) * 10000) / 10000 : 0,
  }));
  rows.sort((a, b) => b.yieldScore - a.yieldScore);
  return rows.slice(0, Math.max(1, Math.min(Number(limit) || 25, MAX_PRODUCTS)));
}

function summary() {
  const w1 = _windowTotals(1); const w7 = _windowTotals(7); const w30 = _windowTotals(30);
  const conv = (a, b) => (a > 0 ? Math.round((b / a) * 10000) / 10000 : 0);
  return {
    ok: true,
    module: NAME,
    generatedAt: new Date().toISOString(),
    visitors: visitors(),
    windows: {
      today: w1,
      last7d: w7,
      last30d: w30,
    },
    conversion30d: {
      viewToProduct: conv(w30.pageViews, w30.productViews),
      productToCheckout: conv(w30.productViews, w30.checkoutStarts),
      checkoutToPaid: conv(w30.checkoutStarts, w30.paid),
      visitorToPaid: conv(w30.sessions, w30.paid),
    },
    topProducts: productYield(10),
    totalEvents: state.totalEvents,
    daysTracked: Object.keys(state.days).length,
    storeFile: STORE_FILE,
  };
}

// ── Persistence ──────────────────────────────────────────────────────
function _serialize() {
  const days = {};
  for (const [k, d] of Object.entries(state.days)) {
    days[k] = {
      pageViews: d.pageViews, productViews: d.productViews,
      checkoutStarts: d.checkoutStarts, paid: d.paid, revenueUsd: d.revenueUsd,
      // Persist today's session ids so reloads (PM2 restarts) don't double
      // count returning sessions within the same day; older days store counts.
      sessions: d.sessions instanceof Set ? Array.from(d.sessions) : Number(d.sessions || 0),
    };
  }
  return { v: 1, savedAt: new Date().toISOString(), totalEvents: state.totalEvents, days, products: state.products };
}

function flush() {
  if (!_dirty) return { ok: true, skipped: true };
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_serialize()));
    fs.renameSync(tmp, STORE_FILE); // atomic swap — never a torn file
    _dirty = false;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function _scheduleFlush() {
  _dirty = true;
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { _flushTimer = null; flush(); }, FLUSH_DEBOUNCE_MS);
  if (_flushTimer.unref) _flushTimer.unref();
}

function _load() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') return;
    state.totalEvents = Number(raw.totalEvents || 0);
    state.products = (raw.products && typeof raw.products === 'object') ? raw.products : {};
    const today = _dayKey();
    for (const [k, d] of Object.entries(raw.days || {})) {
      state.days[k] = {
        pageViews: Number(d.pageViews || 0), productViews: Number(d.productViews || 0),
        checkoutStarts: Number(d.checkoutStarts || 0), paid: Number(d.paid || 0),
        revenueUsd: Number(d.revenueUsd || 0),
        sessions: (k === today && Array.isArray(d.sessions)) ? new Set(d.sessions.slice(0, MAX_SESSIONS_PER_DAY))
          : (Array.isArray(d.sessions) ? d.sessions.length : Number(d.sessions || 0)),
      };
    }
    _pruneDays();
    state.loadedAt = new Date().toISOString();
  } catch (e) {
    console.warn('[' + NAME + '] load failed:', e && e.message);
  }
}

function _resetForTests() {
  state.days = {}; state.products = {}; state.totalEvents = 0; _dirty = false;
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  try { fs.rmSync(STORE_FILE, { force: true }); } catch (_) {}
}

_load();

module.exports = { name: NAME, record, summary, visitors, productYield, flush, STORE_FILE, _resetForTests };
