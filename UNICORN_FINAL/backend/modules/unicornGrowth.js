// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
// unicornGrowth.js — Modul suprem de creștere & marketing
// FAZA 2 / VAL 3 (consolidare supremă)
//
// SURSE absorbite (Grupa E):
//   - auto-marketing, auto-trend-analyzer, autoViralGrowth
//   - content-ai, conversion-intelligence-layer
//   - programmatic-seo-engine, seo-optimizer
//   - socialMediaViralizer, vertical-growth-page-engine
//
// Strategy: facade-composition.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'growth');
const LEDGER_PATH = path.join(DATA_DIR, 'growth-ledger.json');
const MAIN_INTERVAL = 60000; // 60s

const growthBus = new EventEmitter();

function safeRequire(name) {
  try { return require('./' + name); } catch (_) { return null; }
}

const autoMarketing      = safeRequire('auto-marketing');
const autoTrendAnalyzer  = safeRequire('auto-trend-analyzer');
const autoViralGrowth    = safeRequire('autoViralGrowth');
const contentAI          = safeRequire('content-ai');
const conversionLayer    = safeRequire('conversion-intelligence-layer');
const programmaticSEO    = safeRequire('programmatic-seo-engine');
const seoOptimizer       = safeRequire('seo-optimizer');
const socialViralizer    = safeRequire('socialMediaViralizer');
const verticalGrowth     = safeRequire('vertical-growth-page-engine');

const state = {
  startedAt: new Date().toISOString(),
  cycles: 0,
  campaigns: 0,
  pagesGenerated: 0,
  viralEvents: 0,
  history: [],
  active: true,
};

function ensureLedger() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LEDGER_PATH)) fs.writeFileSync(LEDGER_PATH, JSON.stringify({ events: [] }, null, 2));
  } catch (_) { /* silent */ }
}
function appendLedger(entry) {
  try {
    ensureLedger();
    const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8') || '{"events":[]}');
    data.events.push(Object.assign({ at: new Date().toISOString() }, entry));
    if (data.events.length > 2000) data.events = data.events.slice(-2000);
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2));
  } catch (_) { /* silent */ }
}

// ---- Sub-components ----
const marketingEngine = {
  getStatus() { return { name: 'marketingEngine', campaigns: state.campaigns, composed: !!autoMarketing }; },
  launchCampaign(spec = {}) {
    state.campaigns += 1;
    const ev = { type: 'campaign_launched', spec };
    appendLedger(ev);
    growthBus.emit('growth:campaign', ev);
    return { ok: true, id: 'cmp_' + Date.now() };
  },
};

const trendAnalyzer = {
  getStatus() { return { name: 'trendAnalyzer', composed: !!autoTrendAnalyzer }; },
  analyze(opts = {}) {
    try {
      if (autoTrendAnalyzer && typeof autoTrendAnalyzer.analyze === 'function') return autoTrendAnalyzer.analyze(opts);
    } catch (_) { /* silent */ }
    return { ok: true, trends: [], shim: true };
  },
};

const viralGrowth = {
  getStatus() { return { name: 'viralGrowth', composed: !!autoViralGrowth, viralEvents: state.viralEvents }; },
  trigger(seed = {}) {
    state.viralEvents += 1;
    const ev = { type: 'viral_trigger', seed };
    appendLedger(ev);
    growthBus.emit('growth:viral', ev);
    try {
      if (socialViralizer && typeof socialViralizer.broadcast === 'function') socialViralizer.broadcast(seed);
    } catch (_) { /* silent */ }
    return { ok: true };
  },
};

const contentGenerator = {
  getStatus() { return { name: 'contentGenerator', composed: !!contentAI }; },
  generate(brief = {}) {
    try {
      if (contentAI && typeof contentAI.generate === 'function') return contentAI.generate(brief);
    } catch (_) { /* silent */ }
    return { ok: true, content: '[stub content for: ' + (brief.topic || 'unknown') + ']', shim: true };
  },
};

const conversionOptimizer = {
  getStatus() { return { name: 'conversionOptimizer', composed: !!conversionLayer }; },
  optimize(funnel = {}) {
    try {
      if (conversionLayer && typeof conversionLayer.optimize === 'function') return conversionLayer.optimize(funnel);
    } catch (_) { /* silent */ }
    return { ok: true, suggestions: [], shim: true };
  },
};

const seoMesh = {
  getStatus() {
    return {
      name: 'seoMesh',
      programmatic: !!programmaticSEO,
      optimizer: !!seoOptimizer,
      pagesGenerated: state.pagesGenerated,
    };
  },
  generatePages(spec = {}) {
    state.pagesGenerated += Number(spec.count) || 0;
    try {
      if (programmaticSEO && typeof programmaticSEO.generate === 'function') return programmaticSEO.generate(spec);
    } catch (_) { /* silent */ }
    return { ok: true, generated: spec.count || 0, shim: true };
  },
};

const verticalGrowthEngine = {
  getStatus() { return { name: 'verticalGrowthEngine', composed: !!verticalGrowth }; },
  build(vertical = {}) {
    try {
      if (verticalGrowth && typeof verticalGrowth.build === 'function') return verticalGrowth.build(vertical);
    } catch (_) { /* silent */ }
    return { ok: true, vertical: vertical.name || 'unknown', shim: true };
  },
};

// ---- Main cycle ----
function tick() {
  state.cycles += 1;
  growthBus.emit('growth:tick', { cycle: state.cycles, campaigns: state.campaigns, pagesGenerated: state.pagesGenerated });
}

let interval = null;
function start() {
  if (interval) return;
  ensureLedger();
  interval = setInterval(tick, MAIN_INTERVAL);
  if (interval && typeof interval.unref === 'function') interval.unref();
  setTimeout(tick, 4000).unref?.();
}
start();

function getStatus() {
  return {
    name: 'unicornGrowth',
    startedAt: state.startedAt,
    cycles: state.cycles,
    campaigns: state.campaigns,
    pagesGenerated: state.pagesGenerated,
    viralEvents: state.viralEvents,
    active: state.active,
    composed: {
      autoMarketing: !!autoMarketing,
      autoTrendAnalyzer: !!autoTrendAnalyzer,
      autoViralGrowth: !!autoViralGrowth,
      contentAI: !!contentAI,
      conversionLayer: !!conversionLayer,
      programmaticSEO: !!programmaticSEO,
      seoOptimizer: !!seoOptimizer,
      socialViralizer: !!socialViralizer,
      verticalGrowth: !!verticalGrowth,
    },
  };
}

module.exports = {
  getStatus,
  start,
  getBus: () => growthBus,
  marketingEngine,
  trendAnalyzer,
  viralGrowth,
  contentGenerator,
  conversionOptimizer,
  seoMesh,
  verticalGrowthEngine,
  // Re-exports for compat
  autoMarketing,
  autoTrendAnalyzer,
  autoViralGrowth,
  contentAI,
  conversionLayer,
  programmaticSEO,
  seoOptimizer,
  socialViralizer,
  verticalGrowth,
};
