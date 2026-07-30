'use strict';

/**
 * Mutation Boundary Enforcer — MBE/1.0
 * Hard gate: any write touching backend/src must pass forward-only-safety + profile + path allowlist.
 * Blocks silent UEE/selfConstruction style mutations under stable / DISABLE_SELF_MUTATION.
 */

const path = require('path');
const { isoNow, ringPush } = require('./_util');

const PROTOCOL = 'MBE/1.0';
const NAME = 'mutation-boundary-enforcer';

const FORBIDDEN_PREFIXES = [
  'backend/',
  'src/',
  'UNICORN_FINAL/backend/',
  'UNICORN_FINAL/src/',
  'scripts/deploy',
  '.github/',
];

const SAFE_DATA_PREFIXES = [
  'data/',
  'UNICORN_FINAL/data/',
  'docs/',
  'UNICORN_FINAL/docs/',
];

const state = {
  startedAt: null,
  running: false,
  checked: 0,
  allowed: 0,
  denied: 0,
};

/** @type {object[]} */
const _violations = [];

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function _normalizeTarget(target) {
  return String(target || '').replace(/\\/g, '/').replace(/^\.?\//, '');
}

function _isForbiddenPath(target) {
  const t = _normalizeTarget(target);
  if (!t) return false;
  return FORBIDDEN_PREFIXES.some((p) => t === p || t.startsWith(p));
}

function _isSafeDataPath(target) {
  const t = _normalizeTarget(target);
  return SAFE_DATA_PREFIXES.some((p) => t === p || t.startsWith(p));
}

function _fosCheck(operation) {
  try {
    const fos = require('../forward-only-safety');
    if (fos && typeof fos.checkMutation === 'function') {
      return fos.checkMutation(operation);
    }
    if (fos && typeof fos.classifyMutation === 'function') {
      const c = fos.classifyMutation(operation);
      return { ok: !!c.allowed, ...c };
    }
  } catch (_) { /* optional */ }
  return { ok: true, skipped: true, reason: 'forward_only_unavailable' };
}

/**
 * @param {object} input
 * @param {string} input.type — mutation type (feature.add, schema.delete, ...)
 * @param {string|string[]} [input.targets] — file paths
 * @param {string} [input.engine]
 * @param {boolean} [input.readonly]
 */
function enforce(input = {}) {
  start();
  state.checked += 1;
  const type = String(input.type || 'unknown').trim();
  const targets = [].concat(input.targets || input.target || []).map(String).filter(Boolean);
  const engine = String(input.engine || 'unknown');

  const profile = String(process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase();
  const stable = profile === 'stable' || profile === 'safe';
  const selfMutationDisabled = String(process.env.DISABLE_SELF_MUTATION || '') === '1';

  const decision = {
    ok: false,
    protocol: PROTOCOL,
    type,
    engine,
    targets,
    at: isoNow(),
    reasons: [],
  };

  // Growth plane required for forbidden path writes
  const touchesCode = targets.some(_isForbiddenPath);
  if (touchesCode) {
    if (stable) decision.reasons.push('stable_blocks_code_mutation');
    if (selfMutationDisabled) decision.reasons.push('DISABLE_SELF_MUTATION');
    if (String(process.env.ENABLE_FILE_MUTATORS || '') !== '1') {
      decision.reasons.push('ENABLE_FILE_MUTATORS!=1');
    }
  }

  // Forward-only classification
  const fos = _fosCheck({
    type,
    affectsState: input.affectsState,
    readonly: !!input.readonly,
    id: input.id,
  });
  if (fos && fos.ok === false) {
    decision.reasons.push(fos.reason || 'forward_only_denied');
    decision.fos = fos;
  } else {
    decision.fos = fos;
  }

  // Safe data path writes under stable are OK for innovation-ship-gate style artifacts
  const onlySafeData = targets.length > 0 && targets.every(_isSafeDataPath);
  if (onlySafeData && (!fos || fos.ok !== false)) {
    decision.ok = true;
    decision.reasons = ['safe_data_path'];
  } else if (!touchesCode && (!fos || fos.ok !== false)) {
    decision.ok = true;
    if (!decision.reasons.length) decision.reasons.push('non_code_target');
  } else if (!decision.reasons.length && fos && fos.ok !== false) {
    decision.ok = true;
    decision.reasons.push('growth_allowed');
  }

  if (decision.ok) {
    // Final growth gate for code
    if (touchesCode && (stable || selfMutationDisabled || String(process.env.ENABLE_FILE_MUTATORS || '') !== '1')) {
      decision.ok = false;
      if (!decision.reasons.includes('stable_blocks_code_mutation') && stable) {
        decision.reasons.push('stable_blocks_code_mutation');
      }
    }
  }

  if (decision.ok) state.allowed += 1;
  else {
    state.denied += 1;
    ringPush(_violations, decision, 100);
  }
  return decision;
}

function listViolations(limit = 50) {
  return _violations.slice(-Math.min(100, Number(limit) || 50));
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Mutation Boundary Enforcer',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: {
      checked: state.checked,
      allowed: state.allowed,
      denied: state.denied,
      violations: _violations.length,
    },
    forbiddenPrefixes: FORBIDDEN_PREFIXES,
    safeDataPrefixes: SAFE_DATA_PREFIXES,
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/mbe/status',
      'GET /api/mbe/violations',
      'POST /api/mbe/enforce',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  enforce,
  listViolations,
  FORBIDDEN_PREFIXES,
  SAFE_DATA_PREFIXES,
};
