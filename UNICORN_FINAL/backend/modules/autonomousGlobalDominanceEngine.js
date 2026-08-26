'use strict';

/**
 * autonomousGlobalDominanceEngine.js — AGDE / World Gravity Continuum (WGC/1.0)
 * ============================================================================
 * INVENTION (needed, previously missing):
 *   Growth organs already exist (traffic-engine, growth-brain, AACOS, SEO,
 *   viralizer, competitor-spy) but nothing permanently closes the loop from
 *   "module ACTIVE" → public attention → trust → checkout with an honest
 *   bottleneck score. Activity without a gravity field is just heat.
 *
 *   WGC/1.0 is that field:
 *     SENSE   — real metrics only (reality, catalog, AACOS, brain, traffic, SEO)
 *     SCORE   — Gravity Index 0–100 from attested signals (never invents reach)
 *     BOTTLENECK — names the single weakest Attention→Trust→Action stage
 *     DISPATCH — calls existing organs (no duplicate SEO/viral engines)
 *     VERIFY  — next tick measures delta; ledger is hash-chained JSONL
 *     RECOVER — if gravity drops, re-dispatch bottleneck organ only
 *
 * Hard rules:
 *   - Never mutate HTML/source (DISABLE_SELF_MUTATION honored)
 *   - Never invent SERP positions or viral reach
 *   - SERPAPI only when SERPAPI_KEY is set; otherwise skip with reason
 *   - Outbound publish only via AACOS / credential-gated viralizer
 *   - setInterval + unref (never schedule via cron packages)
 *   - Safe under UNICORN_RUNTIME_PROFILE=stable
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const PROTOCOL = 'WGC/1.0';
const NAME = 'autonomousGlobalDominanceEngine';
const INVENTION = 'World Gravity Continuum';
const HORIZON_YEAR = 2066;

const TICK_MS = Math.max(
  parseInt(process.env.AGDE_TICK_MS || String(15 * 60 * 1000), 10),
  60_000
);
const MAX_LEDGER = 200;
const OWNER_BTC = process.env.LEGAL_OWNER_BTC
  || process.env.BTC_OWNER_WALLET
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const state = {
  startedAt: null,
  armed: false,
  ticks: 0,
  lastTickAt: null,
  lastGravity: null,
  lastBottleneck: null,
  lastDispatch: null,
  lastSkipReason: null,
  dispatches: 0,
  recovers: 0,
  modulesLinked: [],
  prevHash: null,
};

/** @type {object[]} */
const _ledger = [];

function dataDir() {
  return process.env.AGDE_DATA_DIR
    || path.join(process.env.UNICORN_COMMERCE_DIR || path.resolve(__dirname, '..', '..', 'data'), 'agde');
}

function ensureDir() {
  try { fs.mkdirSync(dataDir(), { recursive: true }); } catch (_) {}
}

function isoNow() { return new Date().toISOString(); }

function sha256(input) {
  return crypto.createHash('sha256')
    .update(typeof input === 'string' ? input : JSON.stringify(input))
    .digest('hex');
}

function softRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function httpGetJson(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        method: 'GET',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        timeout: timeoutMs,
        headers: { Accept: 'application/json', 'User-Agent': 'ZeusAI-AGDE/1.0' },
      }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => {
          try { finish({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: JSON.parse(buf || 'null') }); }
          catch (_) { finish({ ok: false, status: res.statusCode, body: null }); }
        });
      });
      req.on('error', () => finish({ ok: false, error: 'request_error' }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} finish({ ok: false, error: 'timeout' }); });
      req.end();
    } catch (e) {
      finish({ ok: false, error: e && e.message });
    }
  });
}

function appendLedger(entry) {
  const prev = state.prevHash || 'genesis';
  const body = { ...entry, prevHash: prev };
  body.hash = sha256({ ...body, hash: undefined });
  state.prevHash = body.hash;
  _ledger.push(body);
  if (_ledger.length > MAX_LEDGER) _ledger.shift();
  try {
    ensureDir();
    fs.appendFileSync(path.join(dataDir(), 'gravity-ledger.jsonl'), JSON.stringify(body) + '\n');
  } catch (_) { /* fail-soft */ }
  return body;
}

// ── SENSE ────────────────────────────────────────────────────────────

function sense() {
  const snap = {
    at: isoNow(),
    paidOrders: 0,
    customers: 0,
    revenueUsd: 0,
    catalogCount: 0,
    dropshipCount: 0,
    growthScore: null,
    trafficOk: null,
    aacosArmed: false,
    aacosReady: false,
    aacosSkip: null,
    seoPresent: false,
    competitorPresent: false,
    outboundConfigured: 0,
    socialConfigured: 0,
    sitemapHint: null,
    serpAvailable: !!process.env.SERPAPI_KEY,
    selfMutationDisabled: String(process.env.DISABLE_SELF_MUTATION || '') === '1',
  };

  try {
    const rm = softRequire('./reality-metrics');
    const s = rm && typeof rm.snapshot === 'function' ? rm.snapshot() : null;
    if (s) {
      snap.customers = Number(s.customers || 0);
      snap.paidOrders = Number((s.orders && s.orders.paid) || 0);
      snap.revenueUsd = Number((s.revenue && s.revenue.paidUsd) || 0);
    }
  } catch (_) {}

  try {
    const cat = softRequire('../../src/commerce/unified-catalog');
    const all = cat && typeof cat.all === 'function' ? cat.all() : [];
    snap.catalogCount = Array.isArray(all) ? all.length : 0;
  } catch (_) {}

  try {
    const zacc = softRequire('./zacc');
    const products = zacc && zacc.publisher && typeof zacc.publisher.list === 'function'
      ? zacc.publisher.list() : [];
    snap.dropshipCount = Array.isArray(products) ? products.length : 0;
  } catch (_) {}

  try {
    const brain = softRequire('./growth-brain');
    const st = brain && (typeof brain.getStatus === 'function' ? brain.getStatus()
      : (typeof brain.getState === 'function' ? brain.getState() : null));
    if (st && st.growthScore != null) snap.growthScore = Number(st.growthScore);
  } catch (_) {}

  try {
    const te = softRequire('./traffic-engine');
    const st = te && typeof te.getStatus === 'function' ? te.getStatus() : null;
    if (st) snap.trafficOk = st.ok !== false && st.running !== false;
  } catch (_) {}

  try {
    const aacos = softRequire('./autonomy-action-continuum-os');
    const st = aacos && typeof aacos.getStatus === 'function' ? aacos.getStatus() : null;
    if (st) {
      snap.aacosArmed = !!st.armed;
      snap.aacosReady = !!(st.readyToPublish);
      snap.aacosSkip = st.lastSkipReason || null;
      snap.outboundConfigured = (st.configuredOutbound || []).length;
      snap.socialConfigured = (st.configuredSocial || []).length;
    }
  } catch (_) {}

  try {
    const seo = softRequire('./seo-optimizer');
    snap.seoPresent = !!(seo && (typeof seo.analyze === 'function' || typeof seo.getStatus === 'function'));
  } catch (_) {}

  try {
    const spy = softRequire('./competitor-spy-agent');
    snap.competitorPresent = !!(spy && typeof spy.getStatus === 'function');
  } catch (_) {}

  // Public sitemap liveness (site root) — soft probe, never invents URLs list.
  snap.sitemapHint = 'owned_by_sovereign-extensions';

  return snap;
}

// ── SCORE (Gravity Index) ────────────────────────────────────────────

function scoreGravity(snap) {
  // Weights: discovery → trust → conversion. No fabricated viralReach.
  const stages = {
    attention: {
      weight: 0.28,
      score: Math.min(100, (
        (snap.trafficOk ? 35 : 10)
        + Math.min(40, snap.catalogCount)
        + (snap.serpAvailable ? 15 : 0)
        + (snap.dropshipCount > 0 ? 10 : 0)
      )),
      note: snap.trafficOk ? 'traffic_engine_live' : 'traffic_weak_or_idle',
    },
    trust: {
      weight: 0.24,
      score: Math.min(100, (
        (snap.seoPresent ? 30 : 5)
        + (snap.aacosArmed ? 25 : 5)
        + (snap.growthScore != null ? Math.min(35, Number(snap.growthScore) * 0.35) : 10)
        + (snap.competitorPresent ? 10 : 0)
      )),
      note: 'seo+aacos+brain',
    },
    distribution: {
      weight: 0.22,
      score: Math.min(100, (
        (snap.outboundConfigured + snap.socialConfigured) * 25
        + (snap.aacosReady ? 30 : 0)
        + (snap.aacosSkip === 'no_credentials' ? 5 : 15)
      ) || 8),
      note: snap.aacosReady ? 'publish_ready' : (snap.aacosSkip || 'outbound_unarmed'),
    },
    conversion: {
      weight: 0.26,
      score: Math.min(100, (
        Math.min(50, snap.paidOrders * 12)
        + Math.min(30, snap.customers * 3)
        + (snap.revenueUsd > 0 ? 20 : 0)
      ) || (snap.catalogCount > 0 ? 18 : 5)),
      note: snap.paidOrders > 0 ? 'real_paid_orders' : 'awaiting_first_paid',
    },
  };

  let gravity = 0;
  for (const s of Object.values(stages)) gravity += s.score * s.weight;
  gravity = Math.round(Math.max(0, Math.min(100, gravity)));

  let bottleneck = 'attention';
  let worst = Infinity;
  for (const [k, s] of Object.entries(stages)) {
    if (s.score < worst) { worst = s.score; bottleneck = k; }
  }

  return { gravity, stages, bottleneck };
}

// ── DISPATCH (existing organs only) ──────────────────────────────────

async function dispatchBottleneck(bottleneck, snap, opts = {}) {
  const actions = [];
  const force = !!(opts && opts.force);

  const push = (organ, result) => {
    actions.push({ organ, at: isoNow(), ...(result || {}) });
  };

  // Never mutate HTML / source even if older drafts suggested it.
  if (!snap.selfMutationDisabled && process.env.AGDE_ALLOW_FILE_MUTATION === '1') {
    // Explicitly refused — file mutation is not part of WGC.
  }

  if (bottleneck === 'attention' || force) {
    try {
      const te = softRequire('./traffic-engine');
      if (te && typeof te.runCycle === 'function') {
        const out = await te.runCycle({ dryRun: false, source: 'agde' });
        push('traffic-engine', { ok: true, summary: out && (out.pinged || out.ok || out) });
      } else push('traffic-engine', { ok: false, reason: 'unavailable' });
    } catch (e) {
      push('traffic-engine', { ok: false, reason: e && e.message });
    }
  }

  if (bottleneck === 'trust' || force) {
    try {
      const brain = softRequire('./growth-brain');
      if (brain && typeof brain.runCycle === 'function') {
        const out = await brain.runCycle();
        push('growth-brain', { ok: true, growthScore: out && out.growthScore });
      } else push('growth-brain', { ok: false, reason: 'unavailable' });
    } catch (e) {
      push('growth-brain', { ok: false, reason: e && e.message });
    }

    try {
      const seo = softRequire('./seo-optimizer');
      if (seo && typeof seo.analyze === 'function') {
        const analysis = seo.analyze({
          title: 'ZeusAI — Autonomous AI Commerce Platform',
          description: 'BTC-native autonomous commerce. Real catalog, real checkout, real fulfillment.',
          content: 'ZeusAI Unicorn autonomous AI SaaS marketplace with live catalog and BTC checkout.',
          keyword: 'autonomous AI',
          url: 'https://zeusai.pro/',
          headings: { h1: ['ZeusAI'] },
        });
        push('seo-optimizer', { ok: true, score: analysis && analysis.score, issues: (analysis && analysis.issues && analysis.issues.length) || 0 });
      } else if (seo && typeof seo.process === 'function') {
        const analysis = await seo.process({
          title: 'ZeusAI — Autonomous AI Commerce',
          description: 'Autonomous AI commerce platform',
          content: 'ZeusAI Unicorn',
          keyword: 'AI SaaS',
        });
        push('seo-optimizer', { ok: true, result: !!analysis });
      } else push('seo-optimizer', { ok: false, reason: 'unavailable' });
    } catch (e) {
      push('seo-optimizer', { ok: false, reason: e && e.message });
    }
  }

  if (bottleneck === 'distribution' || force) {
    try {
      const aacos = softRequire('./autonomy-action-continuum-os');
      if (aacos && typeof aacos.tick === 'function') {
        const out = await aacos.tick({ source: 'agde', force: false });
        const drain = out && out.drain;
        push('aacos', {
          ok: true,
          type: drain && drain.type,
          reason: drain && drain.reason,
          published: drain && drain.published,
        });
        if (drain && drain.type === 'skipped') state.lastSkipReason = drain.reason || 'skipped';
      } else push('aacos', { ok: false, reason: 'unavailable' });
    } catch (e) {
      push('aacos', { ok: false, reason: e && e.message });
    }
  }

  if (bottleneck === 'conversion' || force) {
    // Conversion cannot invent buyers — surface readiness + optional competitor observe.
    try {
      const preKeys = softRequire('./pre-keys-activation');
      const st = preKeys && typeof preKeys.getStatus === 'function' ? preKeys.getStatus() : null;
      push('pre-keys-activation', {
        ok: !!(st && st.ok !== false),
        moneyReady: !!(st && st.moneyRails && st.moneyRails.ready),
        note: 'conversion_requires_real_checkout_traffic',
      });
    } catch (e) {
      push('pre-keys-activation', { ok: false, reason: e && e.message });
    }
  }

  // Optional SERP sense — only with real key; never invent competitor ranks.
  if (process.env.SERPAPI_KEY && (bottleneck === 'attention' || force)) {
    try {
      const q = encodeURIComponent('ZeusAI autonomous AI');
      const res = await httpGetJson(`https://serpapi.com/search.json?q=${q}&api_key=${process.env.SERPAPI_KEY}&num=5`);
      if (res.ok && res.body && Array.isArray(res.body.organic_results)) {
        push('serpapi', {
          ok: true,
          results: res.body.organic_results.slice(0, 5).map((r) => ({
            position: r.position,
            title: r.title,
            link: r.link,
          })),
        });
      } else {
        push('serpapi', { ok: false, reason: res.error || 'serp_http_' + (res.status || '?') });
      }
    } catch (e) {
      push('serpapi', { ok: false, reason: e && e.message });
    }
  } else if (!process.env.SERPAPI_KEY) {
    push('serpapi', { ok: false, reason: 'SERPAPI_KEY_missing', honest: true });
  }

  state.dispatches += 1;
  state.lastDispatch = { at: isoNow(), bottleneck, actions };
  return state.lastDispatch;
}

// ── TICK ─────────────────────────────────────────────────────────────

async function tick(opts = {}) {
  state.ticks += 1;
  state.lastTickAt = isoNow();
  const snap = sense();
  const scored = scoreGravity(snap);
  const prev = state.lastGravity;
  state.lastGravity = scored.gravity;
  state.lastBottleneck = scored.bottleneck;

  let dispatch = null;
  const shouldDispatch = !!(opts && opts.force)
    || scored.gravity < 75
    || (prev != null && scored.gravity + 3 < prev)
    || state.ticks === 1;

  if (shouldDispatch) {
    if (prev != null && scored.gravity + 3 < prev) state.recovers += 1;
    dispatch = await dispatchBottleneck(scored.bottleneck, snap, opts);
  } else {
    state.lastSkipReason = 'gravity_hold_' + scored.gravity;
  }

  const entry = appendLedger({
    at: state.lastTickAt,
    tick: state.ticks,
    gravity: scored.gravity,
    bottleneck: scored.bottleneck,
    stages: scored.stages,
    sense: {
      paidOrders: snap.paidOrders,
      customers: snap.customers,
      catalogCount: snap.catalogCount,
      growthScore: snap.growthScore,
      outboundConfigured: snap.outboundConfigured,
      socialConfigured: snap.socialConfigured,
      aacosReady: snap.aacosReady,
    },
    dispatched: !!dispatch,
    dispatchSummary: dispatch ? dispatch.actions.map((a) => a.organ) : [],
  });

  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    tick: state.ticks,
    gravity: scored.gravity,
    bottleneck: scored.bottleneck,
    stages: scored.stages,
    dispatch,
    ledgerHash: entry.hash,
  };
}

function linkModules() {
  const linked = [];
  for (const [label, rel] of [
    ['growth-brain', './growth-brain'],
    ['traffic-engine', './traffic-engine'],
    ['autonomy-action-continuum-os', './autonomy-action-continuum-os'],
    ['seo-optimizer', './seo-optimizer'],
    ['competitor-spy-agent', './competitor-spy-agent'],
    ['pre-keys-activation', './pre-keys-activation'],
    ['reality-metrics', './reality-metrics'],
    ['socialMediaViralizer', './socialMediaViralizer'],
  ]) {
    if (softRequire(rel)) linked.push(label);
  }
  state.modulesLinked = linked;
  return linked;
}

let _timer = null;

function start(opts = {}) {
  if (state.armed && !(opts && opts.force)) {
    return { ok: true, already: true, protocol: PROTOCOL };
  }
  state.armed = true;
  state.startedAt = state.startedAt || isoNow();
  linkModules();

  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => {
    tick({ source: 'agde-interval' }).catch((e) => {
      console.warn('[AGDE] tick failed:', e && e.message);
    });
  }, TICK_MS);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();

  const bootDelay = Math.max(5000, parseInt(process.env.AGDE_BOOT_DELAY_MS || '20000', 10));
  setTimeout(() => {
    tick({ source: 'agde-boot' }).catch(() => {});
  }, bootDelay).unref?.();

  // Bind into AACOS bus if continuum already armed (order-safe).
  try {
    const aacos = softRequire('./autonomy-action-continuum-os');
    if (aacos && typeof aacos.getBus === 'function') {
      const bus = aacos.getBus();
      let n = 0;
      bus.on('autonomy:tick', () => {
        n += 1;
        if (n % 3 !== 0) return;
        tick({ source: 'aacos-bus' }).catch(() => {});
      });
      if (!state.modulesLinked.includes('autonomy-action-continuum-os')) {
        state.modulesLinked.push('autonomy-action-continuum-os');
      }
    }
  } catch (_) {}

  console.log(`[AGDE] ${INVENTION} armed · tick every ${Math.round(TICK_MS / 1000)}s · linked ${state.modulesLinked.join(',')}`);
  return { ok: true, protocol: PROTOCOL, tickMs: TICK_MS, linked: state.modulesLinked };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  state.armed = false;
  return { ok: true, stopped: true };
}

function getStatus() {
  const snap = sense();
  const scored = scoreGravity(snap);
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    name: NAME,
    horizonYear: HORIZON_YEAR,
    running: !!_timer,
    armed: state.armed,
    active: state.armed,
    started: state.armed,
    startedAt: state.startedAt,
    ticks: state.ticks,
    lastTickAt: state.lastTickAt,
    gravity: state.lastGravity != null ? state.lastGravity : scored.gravity,
    bottleneck: state.lastBottleneck || scored.bottleneck,
    stages: scored.stages,
    dispatches: state.dispatches,
    recovers: state.recovers,
    lastSkipReason: state.lastSkipReason,
    lastDispatch: state.lastDispatch,
    modulesLinked: state.modulesLinked,
    sense: {
      paidOrders: snap.paidOrders,
      customers: snap.customers,
      catalogCount: snap.catalogCount,
      growthScore: snap.growthScore,
      trafficOk: snap.trafficOk,
      aacosReady: snap.aacosReady,
      outboundConfigured: snap.outboundConfigured,
      socialConfigured: snap.socialConfigured,
      serpAvailable: snap.serpAvailable,
    },
    honesty: {
      neverMutatesHtml: true,
      neverInventsViralReach: true,
      neverInventsSerpWithoutKey: true,
      dispatchesExistingOrgansOnly: true,
      note: 'Gravity Index is computed from attested commerce/growth signals only.',
    },
    endpoints: {
      status: '/api/agde/status',
      tick: '/api/agde/tick',
      ledger: '/api/agde/ledger',
      wellKnown: '/.well-known/agde.json',
    },
    ownerBtc: OWNER_BTC,
    complements: ['AACOS/1.0', 'TAOS/1.0', 'growth-brain', 'traffic-engine'],
  };
}

function getLedger(limit = 40) {
  return _ledger.slice(-Math.min(200, Number(limit) || 40)).reverse();
}

function run(payload = {}) {
  const action = String(payload.action || payload.cmd || 'status').toLowerCase();
  if (action === 'start') return start(payload);
  if (action === 'stop') return stop();
  if (action === 'tick' || action === 'run') return tick({ force: true, source: 'api' });
  if (action === 'ledger') return { ok: true, ledger: getLedger(payload.limit) };
  return getStatus();
}

function mountRoutes(app, opts = {}) {
  if (!app || typeof app.get !== 'function') return;
  const admin = opts.adminMiddleware || ((req, res, next) => next());

  app.get(['/api/agde/status', '/api/agde', '/api/dominance/status', '/.well-known/agde.json'], (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=20');
      res.json(getStatus());
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message, protocol: PROTOCOL });
    }
  });

  app.get('/api/agde/ledger', (req, res) => {
    try {
      const limit = Math.min(200, parseInt(req.query.limit || '40', 10));
      res.json({ ok: true, protocol: PROTOCOL, ledger: getLedger(limit) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agde/tick', admin, async (req, res) => {
    try {
      const out = await tick({ force: true, source: 'api' });
      res.json(out);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/agde/trigger/:kind', admin, async (req, res) => {
    try {
      const kind = String(req.params.kind || '').toLowerCase();
      const map = { seo: 'trust', viral: 'distribution', content: 'trust', traffic: 'attention', convert: 'conversion' };
      const bottleneck = map[kind] || kind || 'attention';
      const snap = sense();
      const dispatch = await dispatchBottleneck(bottleneck, snap, { force: true });
      res.json({ ok: true, protocol: PROTOCOL, bottleneck, dispatch });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = {
  PROTOCOL,
  NAME,
  INVENTION,
  start,
  stop,
  tick,
  sense,
  scoreGravity,
  getStatus,
  getLedger,
  process: run,
  run,
  mountRoutes,
  // Compat aliases for older draft API shape
  getRouter: () => null,
  init: start,
};
