'use strict';

/**
 * Commerce Twin Portable — CTP/1.0
 * Buyer-owned portable mini-OS: orders, receipts, cancel/refund URLs, export bundle.
 * Keeps working as a signed snapshot even if the operator host is down (offline verify).
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ownerBtc,
} = require('./_util');

const PROTOCOL = 'CTP/1.0';
const NAME = 'commerce-twin-portable';

const state = {
  startedAt: null,
  running: false,
  twinsIssued: 0,
  exports: 0,
};

/** @type {Map<string, object>} */
const _twins = new Map();

function storeFile() {
  return path.join(moduleDir(NAME), 'twins.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    twins: [..._twins.values()].slice(-300),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const t of data.twins || []) {
    if (t && t.twinId) _twins.set(t.twinId, t);
  }
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function issueTwin(input = {}) {
  start();
  const buyerKey = String(input.email || input.buyerId || input.orderId || '').trim().toLowerCase();
  if (!buyerKey) return { ok: false, reason: 'missing_buyer_identity' };

  const orders = Array.isArray(input.orders) ? input.orders : [];
  if (input.orderId) {
    orders.push({
      orderId: input.orderId,
      serviceId: input.serviceId || null,
      amountUsd: input.amountUsd || null,
      status: input.status || 'created',
      txid: input.txid || null,
    });
  }

  const twinId = 'twin_' + sha256(buyerKey).slice(0, 16);
  const base = String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
  const twin = {
    protocol: PROTOCOL,
    twinId,
    buyerKeyHash: sha256(buyerKey),
    ownerBtc: ownerBtc(),
    issuedAt: isoNow(),
    updatedAt: isoNow(),
    orders: orders.slice(0, 50).map((o) => ({
      orderId: String(o.orderId || '').slice(0, 128),
      serviceId: o.serviceId || null,
      amountUsd: o.amountUsd != null ? Number(o.amountUsd) : null,
      status: o.status || 'unknown',
      txid: o.txid || null,
      statusUrl: `${base}/api/order/${encodeURIComponent(String(o.orderId || ''))}/status`,
      checkoutUrl: o.orderId ? `${base}/checkout/${encodeURIComponent(String(o.orderId))}` : null,
      cancelUrl: `${base}/api/frontier/cancel-intent`,
      refundUrl: `${base}/api/frontier/refund-intent`,
      entitlementHint: `${base}/api/entitlements/lookup`,
    })),
    catalogSubset: Array.isArray(input.catalogSubset) ? input.catalogSubset.slice(0, 25) : [],
    note: 'Portable buyer twin — export verifies offline via content hash; live URLs need network.',
  };
  twin.contentHash = sha256({
    twinId: twin.twinId,
    buyerKeyHash: twin.buyerKeyHash,
    orders: twin.orders,
    issuedAt: twin.issuedAt,
  });

  const prev = _twins.get(twinId);
  if (prev && Array.isArray(prev.orders)) {
    const seen = new Set(twin.orders.map((o) => o.orderId));
    for (const o of prev.orders) {
      if (o.orderId && !seen.has(o.orderId)) twin.orders.push(o);
    }
  }
  if (!_twins.has(twinId)) state.twinsIssued += 1;
  twin.updatedAt = isoNow();
  _twins.set(twinId, twin);
  persist();
  return { ok: true, twin };
}

function exportTwin(twinId) {
  const twin = _twins.get(String(twinId || ''));
  if (!twin) return { ok: false, reason: 'twin_not_found' };
  state.exports += 1;
  const bundle = {
    protocol: PROTOCOL,
    exportedAt: isoNow(),
    twin,
    verify: {
      algorithm: 'sha256',
      contentHash: twin.contentHash,
      offline: true,
    },
  };
  bundle.bundleHash = sha256(bundle);
  persist();
  return { ok: true, bundle };
}

function getTwin(twinId) {
  return _twins.get(String(twinId || '')) || null;
}

function verifyBundle(bundle) {
  if (!bundle || !bundle.twin) return { ok: false, reason: 'invalid_bundle' };
  const expected = sha256({
    twinId: bundle.twin.twinId,
    buyerKeyHash: bundle.twin.buyerKeyHash,
    orders: bundle.twin.orders,
    issuedAt: bundle.twin.issuedAt,
  });
  return {
    ok: expected === bundle.twin.contentHash,
    expected,
    actual: bundle.twin.contentHash,
  };
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Commerce Twin Portable',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: {
      twinsIssued: state.twinsIssued,
      twinsStored: _twins.size,
      exports: state.exports,
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/ctp/status',
      'GET /api/ctp/twin/:twinId',
      'POST /api/ctp/issue',
      'POST /api/ctp/export',
      'POST /api/ctp/verify',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  issueTwin,
  exportTwin,
  getTwin,
  verifyBundle,
};
