'use strict';

/**
 * Proof-of-Outcome Protocol — PoOP/1.0
 * Escrow-style outcome market for AI work: pay → deliver → probe → release|refund_intent.
 * Never invents clawbacks on non-custodial BTC; refunds are signed intents for owner settle.
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ringPush, ownerBtc,
} = require('./_util');

const PROTOCOL = 'PoOP/1.0';
const NAME = 'proof-of-outcome-protocol';
const MAX = 500;

const state = {
  startedAt: null,
  running: false,
  opened: 0,
  released: 0,
  refundIntents: 0,
  breached: 0,
};

/** @type {Map<string, object>} */
const _escrows = new Map();
/** @type {object[]} */
const _ledger = [];

function storeFile() {
  return path.join(moduleDir(NAME), 'escrows.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    escrows: [..._escrows.values()].slice(-MAX),
    ledger: _ledger.slice(-200),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const e of data.escrows || []) {
    if (e && e.escrowId) _escrows.set(e.escrowId, e);
  }
  for (const row of data.ledger || []) _ledger.push(row);
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function openEscrow(input = {}) {
  start();
  const orderId = String(input.orderId || input.id || '').trim();
  const serviceId = String(input.serviceId || input.sku || '').trim();
  const amountUsd = Number(input.amountUsd || input.amount || 0);
  if (!orderId) return { ok: false, reason: 'missing_orderId' };
  if (!(amountUsd > 0)) return { ok: false, reason: 'invalid_amount' };

  const escrowId = 'poop_' + sha256(orderId + '|' + serviceId).slice(0, 16);
  if (_escrows.has(escrowId) && _escrows.get(escrowId).status !== 'refund_intent') {
    return { ok: true, duplicate: true, escrow: _escrows.get(escrowId) };
  }

  const slaHours = Number(input.slaHours || process.env.POOP_SLA_HOURS || 72);
  const probes = Array.isArray(input.probes) && input.probes.length
    ? input.probes.map(String)
    : ['artifact_present', 'hash_matches', 'sla_within_window'];

  const escrow = {
    protocol: PROTOCOL,
    escrowId,
    orderId,
    serviceId,
    amountUsd,
    rail: String(input.rail || 'btc-direct'),
    status: 'open',
    phase: 'awaiting_delivery',
    probes,
    probeResults: {},
    openedAt: isoNow(),
    slaDeadline: new Date(Date.now() + slaHours * 3600 * 1000).toISOString(),
    ownerBtc: ownerBtc(),
    deliveryHash: null,
    passportId: null,
    releasedAt: null,
    refundIntentId: null,
    notes: [],
  };
  _escrows.set(escrowId, escrow);
  state.opened += 1;
  ringPush(_ledger, { at: isoNow(), event: 'open', escrowId, orderId }, 200);
  persist();
  return { ok: true, escrow };
}

function attachDelivery(input = {}) {
  const escrowId = String(input.escrowId || '').trim();
  const orderId = String(input.orderId || '').trim();
  let escrow = escrowId ? _escrows.get(escrowId) : null;
  if (!escrow && orderId) {
    escrow = [..._escrows.values()].find((e) => e.orderId === orderId) || null;
  }
  if (!escrow) return { ok: false, reason: 'escrow_not_found' };
  if (escrow.status !== 'open') return { ok: false, reason: 'escrow_not_open', status: escrow.status };

  const artifact = input.artifact || input.delivery || null;
  const deliveryHash = String(input.deliveryHash || (artifact ? sha256(artifact) : '')).trim();
  if (!deliveryHash) return { ok: false, reason: 'missing_deliveryHash' };

  escrow.deliveryHash = deliveryHash;
  escrow.passportId = input.passportId || null;
  escrow.phase = 'awaiting_probes';
  escrow.notes.push({ at: isoNow(), event: 'delivery_attached' });
  _escrows.set(escrow.escrowId, escrow);
  ringPush(_ledger, { at: isoNow(), event: 'delivery', escrowId: escrow.escrowId }, 200);
  persist();
  return { ok: true, escrow };
}

function runProbes(input = {}) {
  const escrowId = String(input.escrowId || '').trim();
  const escrow = _escrows.get(escrowId);
  if (!escrow) return { ok: false, reason: 'escrow_not_found' };
  if (escrow.status !== 'open') return { ok: false, reason: 'escrow_not_open' };

  const results = {};
  for (const probe of escrow.probes) {
    if (probe === 'artifact_present') {
      results[probe] = !!escrow.deliveryHash;
    } else if (probe === 'hash_matches') {
      const expected = String(input.expectedHash || escrow.deliveryHash || '');
      results[probe] = !!escrow.deliveryHash && escrow.deliveryHash === expected;
    } else if (probe === 'sla_within_window') {
      results[probe] = Date.now() <= Date.parse(escrow.slaDeadline || 0);
    } else if (Object.prototype.hasOwnProperty.call(input.overrides || {}, probe)) {
      results[probe] = !!(input.overrides[probe]);
    } else {
      results[probe] = false;
    }
  }
  escrow.probeResults = results;
  const passed = Object.values(results).every(Boolean);
  escrow.phase = passed ? 'probes_passed' : 'probes_failed';
  escrow.notes.push({ at: isoNow(), event: 'probes', passed, results });
  _escrows.set(escrowId, escrow);
  persist();
  return { ok: true, passed, results, escrow };
}

function release(input = {}) {
  const escrowId = String(input.escrowId || '').trim();
  const escrow = _escrows.get(escrowId);
  if (!escrow) return { ok: false, reason: 'escrow_not_found' };
  if (escrow.status !== 'open') return { ok: false, reason: 'escrow_not_open' };

  if (!input.force) {
    const probe = runProbes({ escrowId, expectedHash: escrow.deliveryHash });
    if (!probe.passed) {
      return { ok: false, reason: 'probes_failed', results: probe.results, escrow };
    }
  }

  escrow.status = 'released';
  escrow.phase = 'released';
  escrow.releasedAt = isoNow();
  // Non-custodial: release means attested outcome for owner wallet — no platform float.
  escrow.releaseAttestation = {
    at: escrow.releasedAt,
    hash: sha256({ escrowId, deliveryHash: escrow.deliveryHash, amountUsd: escrow.amountUsd }),
    note: 'Funds already at owner wallet (btc-direct). Release attests outcome acceptance.',
    ownerBtc: ownerBtc(),
  };
  state.released += 1;
  ringPush(_ledger, { at: isoNow(), event: 'release', escrowId }, 200);
  _escrows.set(escrowId, escrow);
  persist();
  return { ok: true, escrow };
}

function openRefundIntent(input = {}) {
  const escrowId = String(input.escrowId || '').trim();
  const escrow = _escrows.get(escrowId);
  if (!escrow) return { ok: false, reason: 'escrow_not_found' };
  if (escrow.status === 'released') return { ok: false, reason: 'already_released' };

  const intentId = 'refund_' + sha256(escrowId + isoNow()).slice(0, 14);
  const intent = {
    intentId,
    protocol: PROTOCOL,
    escrowId,
    orderId: escrow.orderId,
    amountUsd: escrow.amountUsd,
    reason: String(input.reason || 'sla_or_probe_failure').slice(0, 500),
    at: isoNow(),
    executed: false,
    automaticClawback: false,
    note: 'Owner must settle off-platform; PoOP never fakes on-chain clawback for btc-direct.',
    hash: null,
  };
  intent.hash = sha256(intent);
  escrow.status = 'refund_intent';
  escrow.phase = 'refund_intent';
  escrow.refundIntentId = intentId;
  escrow.refundIntent = intent;
  state.refundIntents += 1;
  if (!Object.values(escrow.probeResults || {}).every(Boolean)
    || Date.now() > Date.parse(escrow.slaDeadline || 0)) {
    state.breached += 1;
  }
  ringPush(_ledger, { at: isoNow(), event: 'refund_intent', escrowId, intentId }, 200);
  _escrows.set(escrowId, escrow);
  persist();
  return { ok: true, intent, escrow };
}

function getEscrow(id) {
  return _escrows.get(String(id || '')) || null;
}

function listEscrows(limit = 50) {
  return [..._escrows.values()]
    .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)))
    .slice(0, Math.min(200, Number(limit) || 50));
}

function getStatus() {
  const open = [..._escrows.values()].filter((e) => e.status === 'open').length;
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Proof-of-Outcome Protocol',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: {
      opened: state.opened,
      released: state.released,
      refundIntents: state.refundIntents,
      breached: state.breached,
      openNow: open,
      tracked: _escrows.size,
    },
    honesty: {
      custody: false,
      automaticClawback: false,
      rail: 'btc-direct-owner-wallet',
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/poop/status',
      'GET /api/poop/escrows',
      'POST /api/poop/open',
      'POST /api/poop/deliver',
      'POST /api/poop/probe',
      'POST /api/poop/release',
      'POST /api/poop/refund-intent',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  openEscrow,
  attachDelivery,
  runProbes,
  release,
  openRefundIntent,
  getEscrow,
  listEscrows,
};
