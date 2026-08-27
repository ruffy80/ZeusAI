'use strict';

/**
 * autonomy-action-continuum-os.js — AACOS/1.0
 * ==========================================
 * WORLD-FIRST Autonomy Action Continuum: permanent inter-module action bus.
 *
 * Problem solved: modules reported ACTIVE while queues never drained and
 * mesh stayed paused under UNICORN_RUNTIME_PROFILE=stable.
 *
 * Continuum:
 *   sources (reality/CLOS/ZACC/viral) → bus → actors (outbound / viralizer)
 *   → honest ledger (published | skipped with reason)
 *
 * Runs under EVERY profile including stable. Never invents posts or GMV.
 * Never self-mutates source. Credential-gated outbound only.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const PROTOCOL = 'AACOS/1.0';
const NAME = 'autonomy-action-continuum-os';
const INVENTION = 'Autonomy Action Continuum';
const HORIZON_YEAR = 2066;

const TICK_MS = Math.max(
  parseInt(process.env.AACOS_TICK_MS || String(3 * 60 * 1000), 10),
  30_000
);
const MAX_ACTIONS = 400;

const bus = new EventEmitter();
try { bus.setMaxListeners(80); } catch (_) {}

const state = {
  startedAt: null,
  armed: false,
  ticks: 0,
  intentsEmitted: 0,
  published: 0,
  skipped: 0,
  lastTickAt: null,
  lastActionAt: null,
  lastSkipReason: null,
  modulesLinked: [],
};

/** @type {object[]} */
const _actions = [];

function dataDir() {
  return process.env.AACOS_DATA_DIR
    || path.join(process.env.UNICORN_COMMERCE_DIR || path.resolve(__dirname, '..', '..', 'data'), 'aacos');
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

function record(action) {
  _actions.push(action);
  if (_actions.length > MAX_ACTIONS) _actions.shift();
  state.lastActionAt = action.at;
  try {
    ensureDir();
    fs.appendFileSync(path.join(dataDir(), 'actions.jsonl'), JSON.stringify(action) + '\n');
  } catch (_) { /* fail-soft */ }
}

function getBus() { return bus; }

function _safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function collectEvidence() {
  const evidence = {
    at: isoNow(),
    paidOrders: 0,
    customers: 0,
    revenueUsd: 0,
    closClosed: 0,
    closOpen: 0,
    agyIndex: 0,
    dropshipCount: 0,
    catalogHint: null,
    configuredOutbound: [],
    configuredSocial: [],
  };

  try {
    const rm = _safeRequire('./reality-metrics');
    const snap = rm && typeof rm.snapshot === 'function' ? rm.snapshot() : null;
    if (snap) {
      evidence.customers = Number(snap.customers || 0);
      evidence.paidOrders = Number((snap.orders && snap.orders.paid) || 0);
      evidence.revenueUsd = Number((snap.revenue && snap.revenue.paidUsd) || 0);
    }
  } catch (_) {}

  try {
    const clos = _safeRequire('./closed-loop-commerce-os');
    if (clos) {
      if (typeof clos.agyIndex === 'function') {
        const agy = clos.agyIndex();
        evidence.agyIndex = Number(agy && agy.sovereignYieldIndex) || 0;
        evidence.closClosed = Number(agy && agy.closedLoops) || 0;
        evidence.closOpen = Number(agy && agy.openLoops) || 0;
      }
      if (typeof clos.sweepSla === 'function') {
        try {
          evidence.closSweep = clos.sweepSla();
        } catch (_) {
          evidence.closSweep = { ok: false };
        }
      }
    }
  } catch (_) {}

  try {
    const preKeys = _safeRequire('./pre-keys-activation');
    if (preKeys && typeof preKeys.getStatus === 'function') {
      const pk = preKeys.getStatus();
      evidence.preKeys = {
        protocol: pk && pk.protocol,
        ok: !!(pk && (pk.ok !== false)),
        agentReady: !!(pk && pk.agentReady),
        ownerTomorrow: pk && pk.ownerTomorrow,
        skipSignals: (pk && (pk.skipSignals || pk.blocked || pk.pendingKeys)) || null,
      };
    }
  } catch (_) {}

  try {
    const wf = _safeRequire('./workflowEngine');
    if (wf && typeof wf.getStatus === 'function') {
      const st = wf.getStatus();
      evidence.workflows = { count: st.workflowCount || 0, recentRuns: st.recentRuns || 0 };
    }
  } catch (_) {}

  try {
    const zacc = _safeRequire('./zacc');
    const products = zacc && zacc.publisher && typeof zacc.publisher.list === 'function'
      ? zacc.publisher.list()
      : [];
    evidence.dropshipCount = Array.isArray(products) ? products.length : 0;
    if (Array.isArray(products) && products[0]) {
      evidence.catalogHint = products[0].title || products[0].name || products[0].id || null;
    }
  } catch (_) {}

  try {
    const outbound = _safeRequire('./marketing-innovations/outbound-publisher');
    if (outbound && typeof outbound.enabledPlatforms === 'function') {
      // RSS alone is always-on ledger — not "live social publish ready".
      evidence.configuredOutbound = (outbound.enabledPlatforms() || [])
        .filter((p) => p && p !== 'rss');
    }
  } catch (_) {}

  try {
    const viralizer = _safeRequire('./socialMediaViralizer');
    const inst = viralizer && viralizer.getProviderStatus
      ? viralizer
      : (viralizer && viralizer.default ? viralizer.default : viralizer);
    if (inst && typeof inst.getProviderStatus === 'function') {
      const st = inst.getProviderStatus();
      evidence.configuredSocial = (st && st.configuredProviders) || [];
    }
  } catch (_) {}

  return evidence;
}

function buildIntent(evidence, source) {
  const parts = [];
  parts.push('ZeusAI Unicorn — autonomous commerce continuum.');
  if (evidence.catalogHint) parts.push('Live shelf: ' + String(evidence.catalogHint).slice(0, 80));
  if (evidence.paidOrders > 0) {
    parts.push('Real paid orders: ' + evidence.paidOrders + ' · revenue $' + evidence.revenueUsd);
  } else {
    parts.push('BTC-native checkout · desk dropship · closed-loop proof (CLOS).');
  }
  if (evidence.closClosed > 0) {
    parts.push('Closed commercial loops: ' + evidence.closClosed + ' · AGY ' + evidence.agyIndex);
  }
  parts.push('https://zeusai.pro');
  return {
    id: 'intent_' + sha256(source + isoNow()).slice(0, 12),
    at: isoNow(),
    source: source || 'aacos',
    body: parts.join(' '),
    title: 'ZeusAI Autonomy Continuum',
    url: 'https://zeusai.pro',
    evidence: {
      paidOrders: evidence.paidOrders,
      closClosed: evidence.closClosed,
      dropshipCount: evidence.dropshipCount,
    },
  };
}

async function drainIntent(intent, opts = {}) {
  const at = isoNow();
  const outbound = _safeRequire('./marketing-innovations/outbound-publisher');
  const enabled = outbound && typeof outbound.enabledPlatforms === 'function'
    ? (outbound.enabledPlatforms() || [])
    : [];

  // Prefer marketing outbound (telegram/discord/rss/generic) when armed.
  if (outbound && typeof outbound.broadcast === 'function' && enabled.length) {
    try {
      const result = await outbound.broadcast({
        platforms: enabled,
        body: intent.body,
        title: intent.title,
        url: intent.url,
      });
      const published = Array.isArray(result.results)
        ? result.results.filter((r) => r && r.ok).length
        : 0;
      const skipped = Array.isArray(result.results)
        ? result.results.filter((r) => r && !r.ok)
        : [];
      if (published > 0) {
        state.published += published;
        const action = {
          at, type: 'published', intentId: intent.id, via: 'outbound-publisher',
          published, platforms: enabled, dryRun: !!(result && result.dryRun),
        };
        record(action);
        bus.emit('growth:published', action);
        return action;
      }
      const reason = (skipped[0] && (skipped[0].reason || skipped[0].error)) || 'outbound_no_success';
      state.skipped += 1;
      state.lastSkipReason = reason;
      const action = { at, type: 'skipped', intentId: intent.id, reason, via: 'outbound-publisher' };
      record(action);
      bus.emit('growth:skipped', action);
      return action;
    } catch (e) {
      state.skipped += 1;
      state.lastSkipReason = e && e.message ? e.message : 'outbound_exception';
      const action = { at, type: 'skipped', intentId: intent.id, reason: state.lastSkipReason, via: 'outbound-publisher' };
      record(action);
      bus.emit('growth:skipped', action);
      return action;
    }
  }

  // Social viralizer only when providers configured (and not re-entering from viralizer).
  if (!(opts && opts.skipViralizer)) {
    try {
      const viralizer = _safeRequire('./socialMediaViralizer');
      const inst = viralizer;
      if (inst && typeof inst.getProviderStatus === 'function' && typeof inst.postToAllPlatforms === 'function') {
        const st = inst.getProviderStatus();
        const configured = (st && st.configuredProviders) || [];
        if (configured.length) {
          const postNow = await inst.postToAllPlatforms();
          const keys = postNow && typeof postNow === 'object' ? Object.keys(postNow) : [];
          const published = keys.filter((k) => postNow[k] && postNow[k].ok !== false).length;
          if (published > 0) {
            state.published += published;
            const action = {
              at, type: 'published', intentId: intent.id, via: 'socialMediaViralizer',
              published, platforms: configured,
            };
            record(action);
            bus.emit('growth:published', action);
            return action;
          }
        }
      }
    } catch (_) {}
  }

  // Honest skip — continuum still ticks and communicates.
  state.skipped += 1;
  state.lastSkipReason = 'no_credentials';
  const action = {
    at,
    type: 'skipped',
    intentId: intent.id,
    reason: 'no_credentials',
    note: 'Set TELEGRAM_BOT_TOKEN+CHAT_ID, DISCORD_WEBHOOK_URL, or X tokens to publish live',
    via: 'aacos',
  };
  record(action);
  bus.emit('growth:skipped', action);
  return action;
}

async function handleIntent(intent, opts) {
  state.intentsEmitted += 1;
  bus.emit('growth:intent', intent);
  return drainIntent(intent, opts || {});
}

async function tick(opts = {}) {
  state.ticks += 1;
  state.lastTickAt = isoNow();
  const evidence = collectEvidence();
  bus.emit('autonomy:tick', {
    tick: state.ticks,
    at: state.lastTickAt,
    evidence,
  });
  bus.emit('commerce:signal', {
    paidOrders: evidence.paidOrders,
    revenueUsd: evidence.revenueUsd,
    closClosed: evidence.closClosed,
    dropshipCount: evidence.dropshipCount,
  });

  // Always emit at least one intent per tick so modules have a shared action.
  const force = !!(opts && opts.force);
  const shouldPublishAttempt = force
    || evidence.configuredOutbound.length > 0
    || evidence.configuredSocial.length > 0
    || evidence.paidOrders > 0
    || evidence.dropshipCount > 0
    || state.ticks % 2 === 1; // odd ticks attempt continuum even when empty (honest skip)

  let drain = null;
  if (shouldPublishAttempt) {
    const intent = buildIntent(evidence, opts.source || 'aacos-tick');
    drain = await handleIntent(intent);
  }

  return {
    ok: true,
    protocol: PROTOCOL,
    tick: state.ticks,
    evidence,
    drain,
  };
}

let _timer = null;

function linkModules() {
  const linked = [];
  // Auto-viral: listen and report continuum activity into its event log if present
  try {
    const avg = _safeRequire('./autoViralGrowth');
    if (avg) {
      linked.push('autoViralGrowth');
      bus.on('growth:published', (a) => {
        try {
          if (Array.isArray(avg.events)) {
            avg.events.push({ at: a.at, continuum: 'published', via: a.via, published: a.published });
          }
        } catch (_) {}
      });
      bus.on('growth:skipped', (a) => {
        try {
          if (Array.isArray(avg.events)) {
            avg.events.push({ at: a.at, continuum: 'skipped', reason: a.reason });
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  try {
    const ug = _safeRequire('./unicornGrowth');
    if (ug && typeof ug.getBus === 'function') {
      linked.push('unicornGrowth');
      const gBus = ug.getBus();
      gBus.on('growth:tick', () => {
        // Forward growth ticks into continuum without flooding: every 3rd cycle
        try {
          const st = ug.getStatus && ug.getStatus();
          if (st && st.cycles && st.cycles % 3 === 0) {
            tick({ source: 'unicornGrowth' }).catch(() => {});
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  try {
    const clos = _safeRequire('./closed-loop-commerce-os');
    if (clos) linked.push('closed-loop-commerce-os');
  } catch (_) {}

  try {
    const preKeys = _safeRequire('./pre-keys-activation');
    if (preKeys) linked.push('pre-keys-activation');
  } catch (_) {}

  try {
    const rivos = _safeRequire('../src/commerce/revenue-invention-continuum-os');
    if (rivos) {
      linked.push('revenue-invention-continuum-os');
      bus.on('autonomy:tick', () => {
        try {
          if (typeof rivos.tick === 'function') {
            Promise.resolve(rivos.tick({ source: 'aacos' })).catch(() => {});
          }
        } catch (_) { /* fail-soft */ }
      });
    }
  } catch (_) {}

  try {
    const wf = _safeRequire('./workflowEngine');
    if (wf) linked.push('workflowEngine');
  } catch (_) {}

  try {
    const outbound = _safeRequire('./marketing-innovations/outbound-publisher');
    if (outbound) linked.push('outbound-publisher');
  } catch (_) {}

  try {
    const viralizer = _safeRequire('./socialMediaViralizer');
    if (viralizer) linked.push('socialMediaViralizer');
  } catch (_) {}

  try {
    const zacc = _safeRequire('./zacc');
    if (zacc) linked.push('zacc');
  } catch (_) {}

  try {
    const taos = _safeRequire('./totalAutonomyOs');
    if (taos) linked.push('totalAutonomyOs');
  } catch (_) {}

  try {
    const agde = _safeRequire('./autonomousGlobalDominanceEngine');
    if (agde) {
      linked.push('autonomousGlobalDominanceEngine');
      // Forward continuum ticks into gravity field without flooding (every 3rd).
      let _n = 0;
      bus.on('autonomy:tick', () => {
        _n += 1;
        if (_n % 3 !== 0) return;
        if (typeof agde.tick === 'function') {
          agde.tick({ source: 'aacos-forward' }).catch(() => {});
        }
      });
    }
  } catch (_) {}

  state.modulesLinked = linked;
  return linked;
}

function start(opts = {}) {
  if (state.armed && !(opts && opts.force)) {
    return { ok: true, already: true, protocol: PROTOCOL };
  }
  state.armed = true;
  state.startedAt = state.startedAt || isoNow();
  linkModules();

  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => {
    tick({ source: 'aacos-interval' }).catch((e) => {
      console.warn('[AACOS] tick failed:', e && e.message);
    });
  }, TICK_MS);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();

  // First tick soon after boot
  setTimeout(() => {
    tick({ source: 'aacos-boot' }).catch(() => {});
  }, 8000).unref?.();

  console.log('[AACOS] Autonomy Action Continuum armed · tick every', Math.round(TICK_MS / 1000) + 's · linked', state.modulesLinked.join(','));
  return { ok: true, protocol: PROTOCOL, tickMs: TICK_MS, linked: state.modulesLinked };
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  state.armed = false;
  return { ok: true, stopped: true };
}

function discovery() {
  const evidence = collectEvidence();
  return {
    ok: true,
    protocol: PROTOCOL,
    invention: INVENTION,
    name: NAME,
    horizonYear: HORIZON_YEAR,
    scannedAt: isoNow(),
    endpoints: {
      status: '/api/aacos/status',
      tick: '/api/aacos/tick',
      actions: '/api/aacos/actions',
      wellKnown: '/.well-known/aacos.json',
    },
    armed: state.armed,
    startedAt: state.startedAt,
    ticks: state.ticks,
    intentsEmitted: state.intentsEmitted,
    published: state.published,
    skipped: state.skipped,
    lastTickAt: state.lastTickAt,
    lastActionAt: state.lastActionAt,
    lastSkipReason: state.lastSkipReason,
    tickMs: TICK_MS,
    modulesLinked: state.modulesLinked,
    readyToPublish: evidence.configuredOutbound.length > 0 || evidence.configuredSocial.length > 0,
    configuredOutbound: evidence.configuredOutbound,
    configuredSocial: evidence.configuredSocial,
    preKeysSkip: evidence.preKeys || null,
    closSweep: evidence.closSweep || null,
    evidence,
    recentActions: _actions.slice(-10).reverse(),
    pledge: [
      'Runs permanently under stable AND growth profiles',
      'Modules communicate via autonomy:tick / growth:intent / commerce:signal',
      'Never invents social posts or GMV — skips with reason when unarmed',
      'Outbound only through credential-gated publishers',
    ],
    complements: ['CLOS/1.0', 'TAOS/1.0', 'WDOS/1.0', 'MRCOS/1.0'],
  };
}

function getStatus() { return discovery(); }
function snapshot() { return discovery(); }

function listActions(limit = 50) {
  return _actions.slice(-Math.min(200, Number(limit) || 50)).reverse();
}

function run(action, payload) {
  const a = String(action || '').toLowerCase();
  if (a === 'start') return start(payload || {});
  if (a === 'stop') return stop();
  if (a === 'tick') return tick(payload || { force: true });
  if (a === 'intent' && payload) return handleIntent(payload);
  return discovery();
}

module.exports = {
  PROTOCOL,
  NAME,
  INVENTION,
  getBus,
  bus,
  start,
  stop,
  tick,
  handleIntent,
  collectEvidence,
  discovery,
  getStatus,
  snapshot,
  listActions,
  process: run,
  run,
};
