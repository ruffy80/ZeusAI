// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T14:40:03.780Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// unicornInnovator.js — Modul suprem de inovație și evoluție
// SURSE: Consolidare Grupa C (innovation/evolution/genesis)
//   - innovationEngine.js
//   - autonomousInnovation.js
//   - auto-innovation-loop.js (innovationGenerator)
//   - evolution-core.js (selfEvolver)
//   - ui-evolution.js
//   - unicornAutoGenesis.js (genesisEngine)
//   - unicornInnovationSuite.js
//   - code-optimizer.js (codeOptimizer)
//   - auto-optimize.js
//   - shadow-tester.js (shadowTester)
//   - ai-product-generator.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'innovator');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');
const SEEN_PATH = path.join(DATA_DIR, 'seen.json');
const MAIN_INTERVAL = 60000; // 1min ciclu principal
const MAX_INNOVATIONS_PENDING = 50;

const innovatorBus = new EventEmitter();

const state = {
  startedAt: new Date().toISOString(),
  cycles: 0,
  generated: 0,
  approved: 0,
  rejected: 0,
  pending: [],
  history: [],
  active: true,
  circuitOpen: false,
  consecutiveFailures: 0,
  appliedEvolutions: 0,
  lastDefectKind: null,
  skippedDupes: 0,
};

function ensureStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, JSON.stringify({ items: [] }, null, 2));
  } catch (_) { /* fallback */ }
}
function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function loadSeen() {
  try {
    const raw = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (_) { return []; }
}

function markSeen(hash) {
  try {
    ensureStore();
    const seen = loadSeen();
    if (seen.includes(hash)) return;
    seen.push(hash);
    fs.writeFileSync(SEEN_PATH, JSON.stringify(seen.slice(-400)));
  } catch (_) { /* fail-soft */ }
}

function alreadySeen(hash) {
  return loadSeen().includes(hash);
}

function persistHistory(item) {
  try {
    ensureStore();
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    data.items.push(item);
    if (data.items.length > 500) data.items = data.items.slice(-500);
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
  } catch (_) { /* fallback */ }
}

// ---- Sub-componente ----

// evolutionTracker — urmărește generațiile de cod (sursă: evolution-core.js)
function evolutionTracker() {
  return {
    generation: Math.floor(state.cycles / 10) + 1,
    totalGenerated: state.generated,
    activeBranches: state.pending.length
  };
}

// Deterministic commerce-first idea pool — scored without Math.random so
// innovation-ship-gate can approve/ship real data/ artifacts (never source mutation).
const COMMERCE_IDEAS = [
  { title: 'Checkout recovery email for abandoned BTC invoices', tags: ['checkout', 'email', 'commerce'], score: 0.86 },
  { title: 'WACP catalog export for partner marketplaces', tags: ['catalog', 'wacp', 'commerce', 'trust'], score: 0.91 },
  { title: 'Proof-of-delivery hash on every paid activation pack', tags: ['delivery', 'trust', 'commerce'], score: 0.93 },
  { title: 'SEO landing pages per catalog SKU with honest pricing', tags: ['seo', 'catalog', 'commerce'], score: 0.84 },
  { title: 'Referral credit loop for paid starter/pro upgrades', tags: ['referral', 'growth', 'commerce'], score: 0.88 },
  { title: 'Conversion-truth badge on pricing and status pages', tags: ['trust', 'conversion', 'commerce'], score: 0.87 },
  { title: 'Deterministic fulfillment recipes for legal-bot and data-export', tags: ['delivery', 'fulfillment', 'commerce'], score: 0.9 },
  { title: 'Memory-pressure cache trim under 1.2GB heap soft limit', tags: ['reliability', 'ops'], score: 0.72 },
];

function scoreIdea(idea) {
  const base = Number(idea.score) || 0.5;
  const tagBoost = Array.isArray(idea.tags)
    ? idea.tags.reduce((acc, t) => acc + (/commerce|checkout|delivery|trust|catalog|seo/i.test(t) ? 0.02 : 0), 0)
    : 0;
  return Math.max(0, Math.min(1, Math.round((base + tagBoost) * 1000) / 1000));
}

function dataRoot() {
  return path.resolve(__dirname, '..', '..');
}

function missingSafeFile(rel, title, kind) {
  const abs = path.join(dataRoot(), rel);
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).size > 8) return null;
  } catch (_) { /* treat as missing */ }
  return {
    ideaId: 'defect-' + kind,
    title,
    description: 'Fill missing safe-plane file ' + rel + ' so Unicorn can evolve without source mutation.',
    tags: ['data', 'commerce', 'trust'],
    score: 0.92,
    defectKind: kind,
    field: 'file',
    targetPaths: [rel],
    acceptanceTest: rel + ' exists, valid, inventsGmv=false',
    safeScope: true,
  };
}

function scanDefects() {
  const defects = [];
  const templates = [
    missingSafeFile('data/catalog/next-offer.json', 'Honest next-offer brief for the live catalog', 'missing_next_offer'),
    missingSafeFile('docs/seo/landing-brief.md', 'SEO landing brief with honest SKU pricing', 'missing_seo_brief'),
    missingSafeFile('data/proofs/delivery-proof-template.json', 'Proof-of-delivery template for paid packs', 'missing_delivery_proof'),
    missingSafeFile('data/catalog/sku-notes.json', 'Safe SKU notes overlay (no new SKUs, no prices)', 'missing_sku_notes'),
  ];
  for (const t of templates) if (t) defects.push(t);

  try {
    const healer = require('./unicornSelfHealer');
    const mods = healer && typeof healer.getModules === 'function' ? healer.getModules() : {};
    const broken = Object.entries(mods || {}).filter(([, info]) => info && info.ok === false).slice(0, 3);
    for (const [name] of broken) {
      defects.push({
        ideaId: 'defect-module-' + name,
        title: 'Document heal receipt for module ' + name,
        description: 'Module ' + name + ' reported ok:false. Write a data-plane heal receipt, do not rewrite the module source.',
        tags: ['reliability', 'docs'],
        score: 0.78,
        defectKind: 'module_unhealthy',
        field: 'module.ok',
        targetPaths: ['docs/innovation/heal-' + String(name).replace(/[^a-zA-Z0-9._-]+/g, '-') + '.md'],
        acceptanceTest: 'heal receipt exists; source file untouched',
        safeScope: true,
      });
    }
  } catch (_) { /* healer optional at first require */ }

  try {
    const instant = require('../../src/commerce/instant-catalog');
    const items = instant && typeof instant.all === 'function' ? instant.all() : [];
    for (const item of (items || []).slice(0, 12)) {
      const id = String((item && item.id) || '');
      if (!id) continue;
      const price = Number(item.priceUSD != null ? item.priceUSD : item.price);
      if (!Number.isFinite(price) || price <= 0) {
        defects.push({
          ideaId: 'defect-price-' + id,
          title: 'Document missing price honesty for ' + id,
          description: 'SKU ' + id + ' has no honest price in the instant catalog seed. Record the gap in data/catalog notes — do not invent a price.',
          tags: ['catalog', 'trust', 'commerce'],
          score: 0.88,
          defectKind: 'missing_price',
          field: 'priceUSD',
          targetPaths: ['data/catalog/sku-notes.json'],
          acceptanceTest: 'sku-notes mentions ' + id + ' without inventing priceUSD',
          safeScope: true,
        });
      }
    }
  } catch (_) { /* catalog optional */ }

  return defects;
}

function genomeFitnessBoost() {
  try {
    const genome = require('./ai-genome-engine');
    if (genome && typeof genome.getStatus === 'function') {
      const st = genome.getStatus();
      if (st && st.ok && !(st.disabled)) return 0.03;
    }
  } catch (_) { /* optional */ }
  return 0;
}

function fitness(idea) {
  let s = scoreIdea(idea);
  if (idea && idea.defectKind) s += 0.12;
  if (idea && Array.isArray(idea.targetPaths) && idea.targetPaths.length) s += 0.06;
  if (idea && idea.acceptanceTest) s += 0.04;
  if (idea && idea.inventsGmv) s -= 0.5;
  s += genomeFitnessBoost();
  return Math.max(0, Math.min(1, Math.round(s * 1000) / 1000));
}

function contentHashFor(idea) {
  return sha256(JSON.stringify({
    ideaId: idea && idea.ideaId,
    title: idea && idea.title,
    targetPaths: idea && idea.targetPaths,
    defectKind: idea && idea.defectKind,
  }));
}

function expiresAt() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

// innovationGenerator — defect-first, then unused commerce pool. Dedup by content hash.
function innovationGenerator() {
  if (state.circuitOpen) return null;
  const defects = scanDefects();
  let idea = defects.find((d) => !alreadySeen(contentHashFor(d)));
  if (!idea) {
    idea = COMMERCE_IDEAS.map((c, i) => ({
      ideaId: 'pool-' + i + '-' + String(c.title).slice(0, 24).replace(/\s+/g, '-').toLowerCase(),
      title: c.title,
      description: 'Safe-scope commerce innovation for ZeusAI world standard (data/artifacts only).',
      tags: c.tags.slice(),
      score: c.score,
      defectKind: null,
      field: (c.tags && c.tags[0]) || 'commerce',
      targetPaths: c.tags.includes('catalog')
        ? ['data/catalog/next-offer.json']
        : (c.tags.includes('seo')
          ? ['docs/seo/landing-brief.md']
          : (c.tags.includes('delivery') || c.tags.includes('trust')
            ? ['data/proofs/delivery-proof-template.json']
            : ['docs/innovation/' + String(c.title).slice(0, 40).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() + '.md'])),
      acceptanceTest: 'artifact exists under data/ or docs/; inventsGmv=false',
      safeScope: true,
    })).find((c) => !alreadySeen(contentHashFor(c)));
  }
  if (!idea) {
    state.skippedDupes += 1;
    return null;
  }
  const hash = contentHashFor(idea);
  markSeen(hash);
  state.lastDefectKind = idea.defectKind || 'pool';
  return {
    id: `inv-${Date.now()}-${state.generated}`,
    ideaId: idea.ideaId,
    title: idea.title,
    description: idea.description,
    tags: (idea.tags || []).slice(),
    ts: new Date().toISOString(),
    status: 'pending',
    score: fitness(idea),
    safeScope: true,
    defectKind: idea.defectKind || null,
    field: idea.field || null,
    targetPaths: idea.targetPaths || [],
    acceptanceTest: idea.acceptanceTest,
    contentHash: hash,
    inventsGmv: false,
    expiresAt: expiresAt(),
  };
}

// autonomousInnovator — orchestrare autonomă (sursă: autonomousInnovation.js)
function autonomousInnovator() {
  const inv = innovationGenerator();
  if (!inv) return null;
  state.generated++;
  state.pending.push(inv);
  if (state.pending.length > MAX_INNOVATIONS_PENDING) {
    state.pending = state.pending.slice(-MAX_INNOVATIONS_PENDING);
  }
  innovatorBus.emit('innovator:new', inv);
  return inv;
}

// codeOptimizer — optimizare cod (sursă: code-optimizer.js)
function codeOptimizer() {
  return { suggestedOptimizations: state.pending.filter(p => /optim/i.test(p.title)).length };
}

// selfEvolver — auto-evoluție pe baza artefactelor APLICATE, nu doar approved++
function selfEvolver() {
  let applied = state.appliedEvolutions;
  try {
    const apply = require('./safe-apply-os');
    if (apply && typeof apply.getStatus === 'function') {
      applied = Number(apply.getStatus().applied) || applied;
      state.appliedEvolutions = applied;
    }
  } catch (_) { /* optional */ }
  return { evolutions: applied, approved: state.approved };
}

// genesisEngine — generații din apply-uri reale (data/docs), nu module sursă
function genesisEngine() {
  const ev = selfEvolver();
  return { genesisCount: Math.floor((ev.evolutions || 0) / 5), artifacts: ev.evolutions || 0 };
}

// shadowTester — testează în shadow înainte de approve (sursă: shadow-tester.js)
function shadowTester(innovation) {
  if (!innovation) return { ok: false };
  // Simulare: scoruri peste 0.4 trec testul
  return { ok: innovation.score > 0.4, score: innovation.score };
}

// innovationCircuitBreaker — protecție în caz de eșecuri (concept fail-safe)
function innovationCircuitBreaker(failed) {
  if (failed) {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 5) {
      state.circuitOpen = true;
      innovatorBus.emit('innovator:circuit-open', { failures: state.consecutiveFailures });
      // Auto-reset după 5 min
      setTimeout(() => { state.circuitOpen = false; state.consecutiveFailures = 0; }, 5 * 60 * 1000);
    }
  } else {
    state.consecutiveFailures = 0;
  }
  return { open: state.circuitOpen };
}

// ---- Ciclu principal unic ----
function mainCycle() {
  try {
    state.cycles++;
    const inv = autonomousInnovator();
    if (inv) {
      const test = shadowTester(inv);
      if (!test.ok) innovationCircuitBreaker(true);
      else innovationCircuitBreaker(false);
    }
    state.history.push({ type: 'cycle', cycle: state.cycles, generated: state.generated, ts: new Date().toISOString() });
    if (state.history.length > 200) state.history = state.history.slice(-200);
    innovatorBus.emit('innovator:cycle', { cycle: state.cycles });
  } catch (e) {
    innovationCircuitBreaker(true);
  }
}

function innovationGenerationEnabled() {
  // SAFE_EVOLVE is the safe-plane switch (data/docs proposals). Independent of
  // INNOVATION_GENERATE, which is the growth/source-ship arm.
  if (String(process.env.SAFE_EVOLVE || '1') === '0') return false;
  const profile = String(process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase();
  if (profile === 'safe' || profile === 'stable' || profile === '') {
    return true;
  }
  if (String(process.env.INNOVATION_GENERATE || '').trim() === '0') return false;
  if (profile !== 'growth' && profile !== 'full') return false;
  if (String(process.env.INNOVATION_AUTO_SHIP || '').trim() === '0') return false;
  return true;
}

ensureStore();
if (innovationGenerationEnabled() && (process.env.NODE_ENV !== 'test' || process.env.SAFE_EVOLVE_TEST === '1')) {
  state.active = true;
  setInterval(mainCycle, MAIN_INTERVAL);
  setTimeout(() => { try { mainCycle(); } catch(_){} }, 2000);
} else if (!innovationGenerationEnabled()) {
  state.active = false;
  try {
    console.log('[unicornInnovator] generation idle (SAFE_EVOLVE=0)');
  } catch (_) { /* ignore */ }
} else {
  state.active = false;
}

// ---- API public ----
function getStatus() {
  return {
    active: state.active,
    startedAt: state.startedAt,
    cycles: state.cycles,
    generated: state.generated,
    approved: state.approved,
    rejected: state.rejected,
    pendingCount: state.pending.length,
    circuitOpen: state.circuitOpen,
    generation: evolutionTracker().generation,
    lastDefectKind: state.lastDefectKind,
    skippedDupes: state.skippedDupes,
    appliedEvolutions: selfEvolver().evolutions,
  };
}
function getHistory(limit = 50) { return state.history.slice(-limit); }
function getPending() { return [...state.pending]; }
function approve(id) {
  const idx = state.pending.findIndex(p => p.id === id);
  if (idx < 0) return { ok: false, reason: 'not-found' };
  const inv = state.pending.splice(idx, 1)[0];
  inv.status = 'approved';
  inv.approvedAt = new Date().toISOString();
  state.approved++;
  persistHistory(inv);
  innovatorBus.emit('innovator:approved', inv);
  return { ok: true, innovation: inv };
}
function reject(id) {
  const idx = state.pending.findIndex(p => p.id === id);
  if (idx < 0) return { ok: false, reason: 'not-found' };
  const inv = state.pending.splice(idx, 1)[0];
  inv.status = 'rejected';
  state.rejected++;
  persistHistory(inv);
  return { ok: true, innovation: inv };
}
function getBus() { return innovatorBus; }

module.exports = {
  getStatus,
  getHistory,
  getPending,
  approve,
  reject,
  getBus,
  mainCycle,
  innovationGenerationEnabled,
  // Sub-componente expuse
  evolutionTracker,
  innovationGenerator,
  autonomousInnovator,
  codeOptimizer,
  selfEvolver,
  genesisEngine,
  shadowTester,
  innovationCircuitBreaker,
  scanDefects,
  fitness,
};

// EN: Supreme innovator, consolidates evolution/innovation/genesis modules
// RO: Modul suprem de inovație, consolidează grupul C
