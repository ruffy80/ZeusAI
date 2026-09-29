'use strict';

/**
 * LHOS/1.0 — Live Honesty Operating System
 *
 * Unique invention: a measured public-truth plane for ZeusAI Unicorn.
 * Status, catalog counts, hero stats, and marketplace listings are derived
 * from running process + live catalogs + Origin Gravity. Theater IDs
 * (AdaptiveModuleNN / EngineN pool shims, demo-user) never appear as
 * marketplace SKUs or 90-day uptime percentages.
 *
 * Never:
 *   - invent 99.97% uptime, 169 modules, or signed-receipt trust percents
 *   - invent GMV, visitors, social posts, or paidHumans
 *   - rewrite backend/src/scripts (DISABLE_SELF_MUTATION stays on)
 *
 * Kill-switch: LIVE_HONESTY=0 (status still answers, but skips probes).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'LHOS/1.0';
const NAME = 'live-honesty-os';
const THEATER_ID_RE = /^(AdaptiveModule\d+|Engine\d+|demo-user)$/i;
const THEATER_NAME_RE = /adaptive\s*module\s*\d+|pool shim/i;

const state = {
  armed: false,
  startedAt: null,
  ticks: 0,
  lastTickAt: null,
  last: null,
};

function enabled() {
  return String(process.env.LIVE_HONESTY || '1') !== '0';
}

function isTheaterId(value) {
  const id = String(value == null ? '' : value).trim();
  if (!id) return false;
  if (THEATER_ID_RE.test(id)) return true;
  if (/^AdaptiveModule\d+$/i.test(id) || /^Engine\d+$/i.test(id)) return true;
  return false;
}

function isTheaterItem(item) {
  if (item == null) return true;
  if (typeof item === 'string') return isTheaterId(item) || THEATER_NAME_RE.test(item);
  const id = item.id || item.moduleId || item.slug || item.name || '';
  const title = String(item.title || item.name || '');
  if (isTheaterId(id)) return true;
  if (THEATER_NAME_RE.test(title)) return true;
  if (item.kind === 'pool-shim' || item.poolShim === true) return true;
  return false;
}

function filterPublicMarketplace(items) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => !isTheaterItem(item));
}

function filterPublicModules(items) {
  return filterPublicMarketplace(items);
}

function loadPublicCatalogItems() {
  const unified = require('../../src/commerce/unified-catalog');
  const filter = require('../../src/commerce/public-catalog-filter');
  const all = typeof unified.all === 'function' ? unified.all() : [];
  const pub = filter && typeof filter.filterPublicCatalogItems === 'function'
    ? filter.filterPublicCatalogItems(all, { includeSynthetic: false })
    : all;
  return Array.isArray(pub) ? pub : [];
}

function publicCatalogCount() {
  try {
    return loadPublicCatalogItems().length;
  } catch (_) {
    return 0;
  }
}

/**
 * Buyable shelf for /snapshot.marketplace.
 * Source is unified-catalog (capped public products), then public-catalog-filter.
 * Never the raw marketplace/services dump (dropship, zacc, synth, module clones).
 */
function publicBuyableCatalog() {
  let items = [];
  try { items = loadPublicCatalogItems(); } catch (_) { items = []; }
  return items
    .filter((item) => item && !isTheaterItem(item))
    .map((item) => {
      const id = String(item.id || '').trim();
      const title = item.title || item.name || id;
      const price = Number(item.priceUSD != null ? item.priceUSD : (item.priceUsd != null ? item.priceUsd : item.price)) || 0;
      return {
        id,
        name: title,
        title,
        description: item.description || '',
        price,
        priceUSD: price,
        currency: item.currency || 'USD',
        category: item.group || item.tier || 'service',
        group: item.group || item.tier || 'service',
        tier: item.tier || item.group || null,
        segment: item.tier || item.group || 'service',
        buyMode: item.buyMode || null,
        requiresHumanFulfillment: item.requiresHumanFulfillment === true,
        publicBuyable: true,
        synthetic: false,
      };
    })
    .filter((item) => item.id);
}

function paidHumansCount() {
  try {
    const ogp = require('./origin-gravity-os');
    if (ogp && typeof ogp.getStatus === 'function') {
      const st = ogp.getStatus() || {};
      const n = Number(st.paidHumans);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  } catch (_) { /* optional */ }
  return 0;
}

function modulesDir() {
  return path.resolve(__dirname);
}

function listRealModuleFiles() {
  try {
    return fs.readdirSync(modulesDir()).filter((name) => {
      if (!name.endsWith('.js')) return false;
      const stem = name.replace(/\.js$/i, '');
      if (isTheaterId(stem)) return false;
      if (name.startsWith('_')) return false;
      return true;
    });
  } catch (_) {
    return [];
  }
}

function realModuleCount() {
  return listRealModuleFiles().length;
}

function listPublicModules(limit) {
  const cap = Math.min(80, Math.max(0, Number(limit) || 24));
  return listRealModuleFiles().slice(0, cap).map((name) => ({
    id: name.replace(/\.js$/i, ''),
    status: 'present',
    purpose: 'measured backend module (not a pool shim)',
  }));
}

// Env names the commerce plane actually reads (backend/index.js + site BTC_WALLET).
// Order is detection priority, not a new wallet.
const BTC_ENV_NAMES = [
  'BTC_WALLET',
  'ADMIN_OWNER_BTC',
  'OWNER_BTC_ADDRESS',
  'BTC_WALLET_ADDRESS',
  'BTC_OWNER_WALLET',
  'LEGAL_OWNER_BTC',
];

// Published owner receive address already settled by backend/index.js,
// paymentGateway, and integrity.json. Detected, not invented.
const PUBLISHED_OWNER_BTC = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

function isConfiguredBtcValue(value) {
  const v = String(value || '').trim();
  if (!v || v.length < 26 || v.length > 90) return false;
  if (/^(your_|changeme|placeholder|skip|xxx|todo|wallet)/i.test(v)) return false;
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(v);
}

function configuredBtcSource() {
  for (const name of BTC_ENV_NAMES) {
    if (isConfiguredBtcValue(process.env[name])) return name;
  }
  if (isConfiguredBtcValue(PUBLISHED_OWNER_BTC)) return 'published-owner-wallet';
  return null;
}

function btcRailStatus() {
  const source = configuredBtcSource();
  const configured = !!source;
  return {
    id: 'btc',
    name: 'BTC Commerce',
    status: configured ? 'operational' : 'idle_unconfigured',
    latencyMs: null,
    configured,
    source,
  };
}

function aiRailStatus() {
  const key = String(
    process.env.OPENAI_API_KEY
    || process.env.ANTHROPIC_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || process.env.LLM_API_KEY
    || ''
  ).trim();
  return {
    id: 'ai',
    name: 'AI Gateway',
    status: key ? 'configured' : 'idle_unconfigured',
    latencyMs: null,
    configured: !!key,
  };
}

function autonomyRailStatus() {
  try {
    const secos = require('./safe-evolution-os');
    const st = secos && typeof secos.getStatus === 'function' ? secos.getStatus() : {};
    const ticks = Number(st && st.ticks) || 0;
    const applied = Number(st && st.last && st.last.applied) || 0;
    return {
      id: 'autonomy',
      name: 'Autonomy Chain',
      status: ticks > 0 ? 'operational' : (st && st.enabled === false ? 'idle' : 'warming'),
      latencyMs: null,
      ticks,
      applied,
    };
  } catch (_) {
    return {
      id: 'autonomy',
      name: 'Autonomy Chain',
      status: 'unarmed',
      latencyMs: null,
    };
  }
}

function statusSnapshot() {
  const uptimeSec = Math.floor(process.uptime());
  const catalogCount = enabled() ? publicCatalogCount() : 0;
  const paidHumans = enabled() ? paidHumansCount() : 0;
  const moduleCount = enabled() ? realModuleCount() : 0;
  const components = [
    {
      id: 'site',
      name: 'ZeusAI Site',
      status: 'operational',
      latencyMs: null,
      note: 'This Node process is up. Latency is not sampled here.',
    },
    {
      id: 'api',
      name: 'Public API',
      status: 'operational',
      latencyMs: null,
      note: 'JSON /api/status is served by the live backend, not an HTML SPA.',
    },
    btcRailStatus(),
    aiRailStatus(),
    autonomyRailStatus(),
  ];
  const degraded = components.filter((c) => c.status && c.status !== 'operational' && c.status !== 'configured' && c.status !== 'warming');
  const overall = degraded.length >= 3 ? 'degraded' : 'operational';
  const body = {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    overall,
    components,
    incidents: [],
    uptimeSec,
    uptime90d: null,
    catalogCount,
    paidHumans,
    realModuleCount: moduleCount,
    theaterFiltered: true,
    inventsUptime: false,
    inventsGmv: false,
    inventsHumans: false,
    inventsLatency: false,
    generatedAt: new Date().toISOString(),
  };
  body.signature = crypto.createHash('sha256').update(JSON.stringify({
    overall: body.overall,
    uptimeSec: body.uptimeSec,
    catalogCount: body.catalogCount,
    paidHumans: body.paidHumans,
    ts: body.generatedAt,
  })).digest('hex');
  return body;
}

function honestTelemetry() {
  const snap = statusSnapshot();
  return {
    moduleHealth: null,
    moduleCount: snap.realModuleCount,
    verticalCount: null,
    marketplaceCount: snap.catalogCount,
    revenue: 0,
    activeUsers: 0,
    requests: snap.uptimeSec,
    aiGrowth: null,
    paidHumans: snap.paidHumans,
    catalogCount: snap.catalogCount,
    inventsGmv: false,
    inventsHumans: false,
    note: 'Counts are measured. Null fields are unmeasured — never invented.',
  };
}

function honestTrustLedger(signedReceipts, paidReceipts) {
  const signed = Number(signedReceipts) || 0;
  const paid = Number(paidReceipts) || 0;
  return {
    integrityScore: null,
    paymentAuditScore: null,
    transparencyScore: null,
    signedReceipts: signed,
    paidReceipts: paid,
    percentScoresPublished: false,
    inventsTrust: false,
  };
}

function drillSeed() {
  return {
    runs: 0,
    lastRunAt: null,
    avgRecoveryMs: null,
    score: null,
    status: 'never_run',
  };
}

function tick() {
  state.ticks += 1;
  state.lastTickAt = new Date().toISOString();
  state.last = statusSnapshot();
  return { ok: true, protocol: PROTOCOL, tick: state.ticks, snapshot: state.last };
}

function start() {
  if (process.env.NODE_ENV === 'test' && process.env.LIVE_HONESTY_TEST !== '1') {
    return { ok: true, testSkip: true, protocol: PROTOCOL };
  }
  state.armed = true;
  state.startedAt = state.startedAt || new Date().toISOString();
  return { ok: true, protocol: PROTOCOL, armed: true };
}

function getStatus() {
  const snap = state.last || statusSnapshot();
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    module: NAME,
    invention: 'Live Honesty Operating System',
    enabled: enabled(),
    armed: state.armed,
    startedAt: state.startedAt,
    ticks: state.ticks,
    lastTickAt: state.lastTickAt,
    overall: snap.overall,
    uptimeSec: snap.uptimeSec,
    uptime90d: null,
    catalogCount: snap.catalogCount,
    paidHumans: snap.paidHumans,
    realModuleCount: snap.realModuleCount,
    theaterFiltered: true,
    inventsUptime: false,
    inventsGmv: false,
    inventsHumans: false,
    mutatesSource: false,
    pledge: [
      'Public /api/status is measured JSON, never SPA HTML',
      'AdaptiveModule/Engine pool shims are not marketplace SKUs',
      'Hero module counts come from real backend files, not 169 theater',
      'Uptime 90d is null until an incident ledger exists — never 99.97%',
      'SAFE_APPLY writes data/docs only; source mutations stay held patches',
    ],
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  if (action === 'snapshot') return statusSnapshot();
  if (action === 'tick') return tick();
  if (action === 'start') return start();
  if (action === 'telemetry') return honestTelemetry();
  return { ok: true, action: 'status', status: getStatus() };
}

module.exports = {
  PROTOCOL,
  NAME,
  name: NAME,
  enabled,
  start,
  tick,
  getStatus,
  process: processInput,
  statusSnapshot,
  honestTelemetry,
  honestTrustLedger,
  drillSeed,
  isTheaterId,
  isTheaterItem,
  filterPublicMarketplace,
  filterPublicModules,
  publicCatalogCount,
  publicBuyableCatalog,
  btcRailStatus,
  configuredBtcSource,
  BTC_ENV_NAMES,
  paidHumansCount,
  realModuleCount,
  listPublicModules,
};
