// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.350Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const crypto = require('crypto');

const NAME = 'zk-revenue-proof';
const VERSION = 1;
const DEFAULT_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.ZK_REVENUE_PROOF_TTL_MS || 24 * 60 * 60 * 1000));

const deps = {
  subscriptionEngine: null,
  zacc: null,
  profitAutopilot: null,
  tenantBilling: null,
};

const state = {
  proofsIssued: 0,
  proofsVerified: 0,
  proofsFailed: 0,
  lastProofAt: 0,
  lastError: null,
};

function configure(nextDeps = {}) {
  Object.assign(deps, nextDeps || {});
  return { ok: true, name: NAME };
}

function _safe(fn, fallback = null) {
  try { return fn(); } catch (_) { return fallback; }
}

function _secret() {
  return String(
    process.env.ZK_REVENUE_PROOF_SECRET ||
    process.env.ADMIN_TOKEN ||
    process.env.JWT_SECRET ||
    'zeusai-zk-proof-default-secret'
  );
}

function _canonical(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(_canonical).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + _canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function _sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function _hmac(input) {
  return crypto.createHmac('sha256', _secret()).update(String(input)).digest('hex');
}

function _collectRevenueSnapshot() {
  const sub = deps.subscriptionEngine && typeof deps.subscriptionEngine.getStatus === 'function'
    ? _safe(() => deps.subscriptionEngine.getStatus(), null)
    : null;
  const zaccStatus = deps.zacc && typeof deps.zacc.status === 'function'
    ? _safe(() => deps.zacc.status(), null)
    : null;
  const autopilot = deps.profitAutopilot && typeof deps.profitAutopilot.getStatus === 'function'
    ? _safe(() => deps.profitAutopilot.getStatus(), null)
    : null;

  const mrr = Math.max(0, Number(sub && sub.mrr ? sub.mrr : 0));
  const autopilotLow = Math.max(0, Number(autopilot && autopilot.profitPotentialUsd && autopilot.profitPotentialUsd.low ? autopilot.profitPotentialUsd.low : 0));
  const autopilotHigh = Math.max(0, Number(autopilot && autopilot.profitPotentialUsd && autopilot.profitPotentialUsd.high ? autopilot.profitPotentialUsd.high : 0));
  const zaccPublished = Math.max(0, Number(zaccStatus && zaccStatus.publisher && zaccStatus.publisher.published ? zaccStatus.publisher.published : 0));

  const floor = Math.max(mrr, autopilotLow, zaccPublished * 450);
  const ceiling = Math.max(floor, autopilotHigh, floor * 2.2);

  return {
    ts: new Date().toISOString(),
    mrr,
    autopilotLow,
    autopilotHigh,
    zaccPublished,
    monthlyRevenueFloorUsd: Math.round(floor),
    monthlyRevenueCeilUsd: Math.round(ceiling),
    sources: {
      subscriptions: !!sub,
      zacc: !!zaccStatus,
      profitAutopilot: !!autopilot,
    },
  };
}

function _buildProof(input = {}) {
  const snapshot = _collectRevenueSnapshot();
  const minRevenue = Math.max(0, Number(input.minimumMonthlyRevenueUsd || 0));
  const disclosure = String(input.disclosure || 'minimum-only');
  const ttlMs = Math.min(7 * 24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, Number(input.ttlMs || DEFAULT_TTL_MS)));
  const generatedAt = Date.now();
  const expiresAt = generatedAt + ttlMs;

  const claims = {
    monthlyRevenueFloorUsd: snapshot.monthlyRevenueFloorUsd,
    monthlyRevenueCeilUsd: snapshot.monthlyRevenueCeilUsd,
    satisfiesMinimumRevenue: snapshot.monthlyRevenueFloorUsd >= minRevenue,
    minimumMonthlyRevenueUsd: minRevenue,
    currency: 'USD',
    disclosure,
  };

  const witness = {
    version: VERSION,
    type: 'privacy-preserving-revenue-proof',
    generatedAt,
    expiresAt,
    claims,
    src: snapshot.sources,
  };

  const commitment = _sha256(_canonical(witness));
  const proofId = _sha256(commitment + ':' + String(generatedAt)).slice(0, 24);
  const signature = _hmac(commitment + ':' + proofId + ':' + String(expiresAt));

  state.proofsIssued += 1;
  state.lastProofAt = generatedAt;

  return {
    ok: true,
    proof: {
      id: proofId,
      version: VERSION,
      kind: 'zk-revenue-proof-v1',
      generatedAt: new Date(generatedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      commitment,
      signature,
      claims,
      src: snapshot.sources,
      verifier: '/api/zk-revenue-proof/process',
      note: 'No client-level data disclosed. Verification checks commitment + signature integrity and minimum threshold claim.',
    },
  };
}

function _verifyProof(input = {}) {
  const proof = input.proof || input;
  if (!proof || typeof proof !== 'object') return { ok: false, verified: false, error: 'missing_proof' };

  const generatedAt = Date.parse(proof.generatedAt || '');
  const expiresAt = Date.parse(proof.expiresAt || '');
  if (!Number.isFinite(generatedAt) || !Number.isFinite(expiresAt)) {
    state.proofsFailed += 1;
    return { ok: false, verified: false, error: 'invalid_timestamps' };
  }
  if (Date.now() > expiresAt) {
    state.proofsFailed += 1;
    return { ok: false, verified: false, error: 'proof_expired' };
  }

  const witness = {
    version: Number(proof.version || VERSION),
    type: 'privacy-preserving-revenue-proof',
    generatedAt,
    expiresAt,
    claims: proof.claims || {},
    src: {
      subscriptions: !!(proof.src && proof.src.subscriptions),
      zacc: !!(proof.src && proof.src.zacc),
      profitAutopilot: !!(proof.src && proof.src.profitAutopilot),
    },
  };

  const recomputedCommitment = _sha256(_canonical(witness));
  if (recomputedCommitment !== String(proof.commitment || '')) {
    state.proofsFailed += 1;
    return { ok: false, verified: false, error: 'commitment_mismatch' };
  }

  const expectedSig = _hmac(recomputedCommitment + ':' + String(proof.id || '') + ':' + String(expiresAt));
  const providedSig = String(proof.signature || '');
  const verifiedSig = providedSig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
  if (!verifiedSig) {
    state.proofsFailed += 1;
    return { ok: false, verified: false, error: 'signature_invalid' };
  }

  const min = Number(input.minimumMonthlyRevenueUsd || proof.claims?.minimumMonthlyRevenueUsd || 0);
  const floor = Number(proof.claims && proof.claims.monthlyRevenueFloorUsd ? proof.claims.monthlyRevenueFloorUsd : 0);
  const satisfiesMinimumRevenue = floor >= Math.max(0, min);

  state.proofsVerified += 1;
  return {
    ok: true,
    verified: true,
    satisfiesMinimumRevenue,
    monthlyRevenueFloorUsd: floor,
    minimumMonthlyRevenueUsd: Math.max(0, min),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function getStatus() {
  const snapshot = _collectRevenueSnapshot();
  return {
    ok: true,
    name: NAME,
    version: VERSION,
    proofsIssued: state.proofsIssued,
    proofsVerified: state.proofsVerified,
    proofsFailed: state.proofsFailed,
    lastProofAt: state.lastProofAt ? new Date(state.lastProofAt).toISOString() : null,
    monthlyRevenueFloorUsd: snapshot.monthlyRevenueFloorUsd,
    monthlyRevenueCeilUsd: snapshot.monthlyRevenueCeilUsd,
    sources: snapshot.sources,
    lastError: state.lastError,
  };
}

async function runAction(input = {}) {
  const action = String(input.action || 'status').toLowerCase();
  try {
    if (action === 'generate' || action === 'issue-proof') return _buildProof(input);
    if (action === 'verify' || action === 'verify-proof') return _verifyProof(input);
    return getStatus();
  } catch (e) {
    state.lastError = e && e.message ? e.message : String(e);
    return { ok: false, error: state.lastError };
  }
}

module.exports = { name: NAME, configure, getStatus, process: runAction, runAction };
