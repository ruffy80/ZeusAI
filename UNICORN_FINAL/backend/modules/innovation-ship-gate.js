'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'innovation-ship-gate';
const APPROVE_THRESHOLD = 0.65;
const REJECT_THRESHOLD = 0.2;
const AUTO_INTERVAL_MS = 5 * 60 * 1000;

const KEYWORDS = [
  { term: 'commerce', weight: 0.18 },
  { term: 'checkout', weight: 0.18 },
  { term: 'delivery', weight: 0.16 },
  { term: 'seo', weight: 0.14 },
  { term: 'trust', weight: 0.16 },
  { term: 'catalog', weight: 0.18 },
];

const SAFE_HINTS = ['catalog', 'docs', 'documentation', 'seo', 'delivery-proof', 'data', 'content'];
const SAFE_PREFIXES = [/^data\//i, /^docs\//i, /^catalog\//i, /^content\//i];
const UNSAFE_PREFIXES = [/^backend\//i, /^src\//i, /^scripts\//i, /^\.github\//i];

const state = {
  cycles: 0,
  evaluated: 0,
  approved: 0,
  rejected: 0,
  deferred: 0,
  shippedArtifacts: 0,
  lastCycleAt: null,
  lastDecisions: [],
};

let autoTimer = null;

function shippedDir() {
  return process.env.INNOVATION_SHIPPED_DIR || path.resolve(__dirname, '..', '..', 'data', 'innovations', 'shipped');
}

function ensureDir() {
  fs.mkdirSync(shippedDir(), { recursive: true });
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  return [];
}

function getInnovationText(innovation) {
  const src = innovation && typeof innovation === 'object' ? innovation : {};
  const parts = [
    src.title,
    src.description,
    src.summary,
    src.scope,
    src.domain,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function inferTargetPaths(innovation) {
  const src = innovation && typeof innovation === 'object' ? innovation : {};
  const direct = []
    .concat(stringList(src.targetPaths))
    .concat(stringList(src.paths))
    .concat(stringList(src.files))
    .concat(stringList(src.path));
  if (direct.length) return direct;

  const text = getInnovationText(src);
  const inferred = [];
  if (text.includes('catalog')) inferred.push('data/catalog/next-offer.json');
  if (text.includes('seo')) inferred.push('docs/seo/landing-brief.md');
  if (text.includes('delivery') || text.includes('trust')) inferred.push('data/proofs/delivery-proof-template.json');
  if (!inferred.length) inferred.push('docs/innovation/' + String(src.id || 'proposal') + '.md');
  return inferred;
}

function isSafeInnovation(innovation) {
  const text = getInnovationText(innovation);
  const paths = inferTargetPaths(innovation);
  if (paths.some((target) => UNSAFE_PREFIXES.some((pattern) => pattern.test(target)))) {
    return { safe: false, reason: 'targets_source_or_runtime_paths', paths };
  }
  if (text.includes('backend/modules') || text.includes('source mutation') || text.includes('rewrite module') || text.includes('edit code')) {
    return { safe: false, reason: 'describes_source_mutation', paths };
  }
  const safePaths = paths.every((target) => SAFE_PREFIXES.some((pattern) => pattern.test(target)));
  const hintedSafe = SAFE_HINTS.some((hint) => text.includes(hint));
  if (!safePaths && !hintedSafe) return { safe: false, reason: 'outside_safe_scope', paths };
  return { safe: true, reason: 'catalog_docs_data_only', paths };
}

function score(innovation) {
  const text = getInnovationText(innovation);
  let total = 0;
  for (const rule of KEYWORDS) {
    if (text.includes(rule.term)) total += rule.weight;
  }
  if (/proof|schema|manifest|receipt/.test(text)) total += 0.08;
  if (/buyer|order|trust|checkout/.test(text)) total += 0.06;
  const safety = isSafeInnovation(innovation);
  if (safety.safe) total += 0.08;
  return Number(clamp(total).toFixed(4));
}

function buildSpec(innovation, computedScore, safety) {
  const src = innovation && typeof innovation === 'object' ? innovation : {};
  const paths = safety.paths;
  return {
    id: String(src.id || 'innovation-' + Date.now()),
    title: String(src.title || 'Untitled innovation'),
    description: String(src.description || src.summary || ''),
    score: computedScore,
    approvedAt: new Date().toISOString(),
    safeScope: 'catalog/docs/data only',
    targetPaths: paths,
    tasks: [
      'Create or update catalog/data documents at the approved target paths.',
      'Document checkout, delivery, SEO, or trust behavior in a machine-readable artifact.',
      'Add acceptance examples under data/ or docs/ without mutating source code.',
    ],
    acceptanceCriteria: [
      'No writes under backend/, src/, or scripts/.',
      'Artifacts describe a concrete commerce improvement with input/output examples.',
      'Changes can be reviewed as data/docs additions without self-mutation.',
    ],
    notes: {
      disableSelfMutation: process.env.DISABLE_SELF_MUTATION === '1',
      rationale: safety.reason,
    },
  };
}

function writeArtifact(spec) {
  ensureDir();
  const fileName = String(spec.id).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) + '.json';
  const fullPath = path.join(shippedDir(), fileName);
  fs.writeFileSync(fullPath, JSON.stringify(spec, null, 2));
  state.shippedArtifacts += 1;
  return fullPath;
}

function defaultInnovatorApi() {
  return require('./supreme-innovator-adapter');
}

async function evaluateAndShip(innovatorApi) {
  const api = innovatorApi || defaultInnovatorApi();
  if (!api || typeof api.getPending !== 'function' || typeof api.approve !== 'function' || typeof api.reject !== 'function') {
    throw new Error('innovatorApi must expose getPending/approve/reject');
  }

  const pending = await Promise.resolve(api.getPending());
  const decisions = [];

  for (const innovation of Array.isArray(pending) ? pending : []) {
    const innovationId = String(innovation && innovation.id || '');
    const innovationScore = score(innovation);
    const safety = isSafeInnovation(innovation);
    state.evaluated += 1;

    if (innovationScore >= APPROVE_THRESHOLD && safety.safe) {
      const approval = await Promise.resolve(api.approve(innovationId));
      const spec = buildSpec(innovation, innovationScore, safety);
      const artifactPath = writeArtifact(spec);
      state.approved += 1;
      decisions.push({
        id: innovationId,
        decision: 'approved',
        score: innovationScore,
        safety: safety.reason,
        artifactPath,
        approval,
      });
      continue;
    }

    if (!safety.safe || innovationScore <= REJECT_THRESHOLD) {
      const rejection = await Promise.resolve(api.reject(innovationId));
      state.rejected += 1;
      decisions.push({
        id: innovationId,
        decision: 'rejected',
        score: innovationScore,
        safety: safety.reason,
        rejection,
      });
      continue;
    }

    state.deferred += 1;
    decisions.push({
      id: innovationId,
      decision: 'deferred',
      score: innovationScore,
      safety: safety.reason,
    });
  }

  state.cycles += 1;
  state.lastCycleAt = new Date().toISOString();
  state.lastDecisions = decisions.slice(-20);
  return {
    ok: true,
    cycle: state.cycles,
    evaluated: decisions.length,
    decisions,
  };
}

function startAutoCycle(innovatorApi, intervalMs = AUTO_INTERVAL_MS) {
  if (autoTimer) return { ok: true, alreadyRunning: true };
  if (process.env.INNOVATION_AUTO_SHIP !== '1') return { ok: false, reason: 'disabled_by_env' };
  autoTimer = setInterval(() => {
    evaluateAndShip(innovatorApi).catch((error) => {
      console.warn('[innovation-ship-gate] auto cycle failed:', error && error.message);
    });
  }, Math.max(60_000, Number(intervalMs || AUTO_INTERVAL_MS)));
  if (autoTimer.unref) autoTimer.unref();
  return { ok: true, intervalMs: Math.max(60_000, Number(intervalMs || AUTO_INTERVAL_MS)) };
}

function stopAutoCycle() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
  return { ok: true };
}

function getStatus() {
  ensureDir();
  return {
    module: NAME,
    autoShipEnabled: process.env.INNOVATION_AUTO_SHIP === '1',
    disableSelfMutation: process.env.DISABLE_SELF_MUTATION === '1',
    shippedDir: shippedDir(),
    autoRunning: !!autoTimer,
    thresholds: { approve: APPROVE_THRESHOLD, reject: REJECT_THRESHOLD },
    metrics: {
      cycles: state.cycles,
      evaluated: state.evaluated,
      approved: state.approved,
      rejected: state.rejected,
      deferred: state.deferred,
      shippedArtifacts: state.shippedArtifacts,
    },
    lastCycleAt: state.lastCycleAt,
    recentDecisions: state.lastDecisions,
  };
}

async function processInput(input = {}) {
  const action = String(input.action || 'status');
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : input;
  if (action === 'score') return { ok: true, action, score: score(payload.innovation || payload) };
  if (action === 'evaluate') return evaluateAndShip(payload.innovatorApi || input.innovatorApi);
  if (action === 'cycle') {
    if (process.env.INNOVATION_AUTO_SHIP !== '1') {
      return { ok: false, action, error: 'INNOVATION_AUTO_SHIP disabled' };
    }
    return evaluateAndShip(payload.innovatorApi || input.innovatorApi);
  }
  if (action === 'start-auto') return startAutoCycle(payload.innovatorApi || input.innovatorApi, payload.intervalMs || input.intervalMs);
  if (action === 'stop-auto') return stopAutoCycle();
  return { ok: true, action: 'status', status: getStatus() };
}

function _resetForTests() {
  stopAutoCycle();
  state.cycles = 0;
  state.evaluated = 0;
  state.approved = 0;
  state.rejected = 0;
  state.deferred = 0;
  state.shippedArtifacts = 0;
  state.lastCycleAt = null;
  state.lastDecisions = [];
}

module.exports = {
  name: NAME,
  score,
  evaluateAndShip,
  startAutoCycle,
  stopAutoCycle,
  getStatus,
  process: processInput,
  _resetForTests,
};
