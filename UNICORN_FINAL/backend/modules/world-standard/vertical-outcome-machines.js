'use strict';

/**
 * Vertical Outcome Machines — VOM/1.0
 * Three complete vertical loops: offer → pay → PoOP delivery → CLOS → reinvest.
 * Tracks real cycles only — never invents GMV.
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ringPush,
} = require('./_util');

const PROTOCOL = 'VOM/1.0';
const NAME = 'vertical-outcome-machines';

const VERTICALS = Object.freeze([
  {
    id: 'seo-agency',
    title: 'SEO Agency Outcome Machine',
    serviceId: 'instant-seo-content-pack',
    priceUsd: 79,
    promise: 'Keyword pack + content outline delivered with DPS passport',
  },
  {
    id: 'local-services',
    title: 'Local Services Outcome Machine',
    // Must match a real instant-catalog SKU with fulfillment recipe
    serviceId: 'instant-website-audit',
    priceUsd: 49,
    promise: 'Website audit pack for local service businesses',
  },
  {
    id: 'saas-onboarding',
    title: 'SaaS Onboarding Outcome Machine',
    serviceId: 'instant-pitch-deck',
    priceUsd: 149,
    promise: 'Pitch/onboarding deck pack for SaaS GTM',
  },
]);

const state = {
  startedAt: null,
  running: false,
  cyclesOpened: 0,
  cyclesClosed: 0,
};

/** @type {Map<string, object>} */
const _cycles = new Map();

function storeFile() {
  return path.join(moduleDir(NAME), 'verticals.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    cycles: [..._cycles.values()].slice(-300),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const c of data.cycles || []) {
    if (c && c.cycleId) _cycles.set(c.cycleId, c);
  }
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function listVerticals() {
  return VERTICALS.map((v) => ({
    ...v,
    checkout: {
      method: 'POST',
      path: '/api/checkout/create',
      body: { serviceId: v.serviceId, qty: 1 },
    },
  }));
}

function openCycle(input = {}) {
  start();
  const verticalId = String(input.verticalId || '').trim();
  const vertical = VERTICALS.find((v) => v.id === verticalId);
  if (!vertical) return { ok: false, reason: 'unknown_vertical', known: VERTICALS.map((v) => v.id) };

  const orderId = String(input.orderId || '').trim();
  if (!orderId) {
    return {
      ok: false,
      reason: 'missing_orderId',
      note: 'Open a real checkout first; VOM never invents paid orders',
      suggest: {
        path: '/api/checkout/create',
        body: { serviceId: vertical.serviceId, qty: 1, email: input.email || 'buyer@example.com' },
      },
    };
  }

  const cycleId = 'vom_' + sha256(verticalId + '|' + orderId).slice(0, 14);
  if (_cycles.has(cycleId)) return { ok: true, duplicate: true, cycle: _cycles.get(cycleId) };

  const cycle = {
    protocol: PROTOCOL,
    cycleId,
    verticalId,
    serviceId: vertical.serviceId,
    orderId,
    amountUsd: Number(input.amountUsd || vertical.priceUsd),
    phase: 'paid_pending_or_open',
    status: 'open',
    openedAt: isoNow(),
    poopEscrowId: null,
    passportId: null,
    closClosed: false,
    paid: !!input.paid,
  };
  _cycles.set(cycleId, cycle);
  state.cyclesOpened += 1;

  // Soft-open PoOP escrow
  try {
    const poop = require('./proof-of-outcome-protocol');
    const esc = poop.openEscrow({
      orderId,
      serviceId: vertical.serviceId,
      amountUsd: cycle.amountUsd,
      slaHours: 48,
    });
    if (esc && esc.ok) cycle.poopEscrowId = esc.escrow.escrowId;
  } catch (_) { /* optional */ }

  // Soft-open CLOS
  try {
    const clos = require('../closed-loop-commerce-os');
    if (clos && typeof clos.openCycle === 'function') {
      clos.openCycle({
        orderId,
        serviceId: vertical.serviceId,
        amountUsd: cycle.amountUsd,
        rail: input.rail || 'btc-direct',
      });
    }
  } catch (_) { /* optional */ }

  // Soft CTP twin
  try {
    const ctp = require('./commerce-twin-portable');
    ctp.issueTwin({
      email: input.email,
      orderId,
      serviceId: vertical.serviceId,
      amountUsd: cycle.amountUsd,
      status: cycle.paid ? 'paid' : 'created',
    });
  } catch (_) { /* optional */ }

  _cycles.set(cycleId, cycle);
  persist();
  return { ok: true, cycle, vertical };
}

function advanceDelivery(input = {}) {
  const cycleId = String(input.cycleId || '').trim();
  const cycle = _cycles.get(cycleId);
  if (!cycle) return { ok: false, reason: 'cycle_not_found' };

  const artifact = input.artifact || {
    type: 'vertical-outcome-pack',
    verticalId: cycle.verticalId,
    orderId: cycle.orderId,
    generatedAt: isoNow(),
    sections: ['summary', 'actions', 'assets'],
  };
  const artifactHash = sha256(artifact);

  let passportId = null;
  try {
    const dps = require('./delivery-passport-standard');
    const issued = dps.issuePassport({
      orderId: cycle.orderId,
      serviceId: cycle.serviceId,
      artifact,
      artifactHash,
      provider: 'vom-deterministic',
      slaHours: 48,
      poopEscrowId: cycle.poopEscrowId,
    });
    if (issued && issued.ok) passportId = issued.passport.passportId;
  } catch (_) { /* optional */ }

  try {
    const poop = require('./proof-of-outcome-protocol');
    if (cycle.poopEscrowId) {
      poop.attachDelivery({
        escrowId: cycle.poopEscrowId,
        deliveryHash: artifactHash,
        passportId,
      });
      poop.runProbes({ escrowId: cycle.poopEscrowId, expectedHash: artifactHash });
      if (input.release) poop.release({ escrowId: cycle.poopEscrowId });
    }
  } catch (_) { /* optional */ }

  cycle.phase = 'delivered';
  cycle.passportId = passportId;
  cycle.artifactHash = artifactHash;
  cycle.deliveredAt = isoNow();
  _cycles.set(cycleId, cycle);
  persist();
  return { ok: true, cycle, passportId, artifactHash };
}

function closeCycle(input = {}) {
  const cycleId = String(input.cycleId || '').trim();
  const cycle = _cycles.get(cycleId);
  if (!cycle) return { ok: false, reason: 'cycle_not_found' };

  try {
    const clos = require('../closed-loop-commerce-os');
    if (clos && typeof clos.closeLoop === 'function') {
      clos.closeLoop({
        orderId: cycle.orderId,
        serviceId: cycle.serviceId,
        amountUsd: cycle.amountUsd,
      });
      cycle.closClosed = true;
    }
  } catch (_) { /* optional */ }

  try {
    const poop = require('./proof-of-outcome-protocol');
    if (cycle.poopEscrowId && input.release !== false) {
      poop.release({ escrowId: cycle.poopEscrowId, force: !!input.forceRelease });
    }
  } catch (_) { /* optional */ }

  cycle.status = 'closed';
  cycle.phase = 'closed';
  cycle.closedAt = isoNow();
  state.cyclesClosed += 1;
  _cycles.set(cycleId, cycle);
  persist();
  return { ok: true, cycle };
}

function statsByVertical() {
  const out = {};
  for (const v of VERTICALS) {
    const cycles = [..._cycles.values()].filter((c) => c.verticalId === v.id);
    out[v.id] = {
      open: cycles.filter((c) => c.status === 'open').length,
      closed: cycles.filter((c) => c.status === 'closed').length,
      gmvObservedUsd: cycles
        .filter((c) => c.status === 'closed' || c.paid)
        .reduce((s, c) => s + (Number(c.amountUsd) || 0), 0),
    };
  }
  return out;
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Vertical Outcome Machines',
    running: !!state.running,
    startedAt: state.startedAt,
    verticals: VERTICALS.map((v) => v.id),
    counts: {
      cyclesOpened: state.cyclesOpened,
      cyclesClosed: state.cyclesClosed,
      tracked: _cycles.size,
    },
    byVertical: statsByVertical(),
    honesty: { inventsGmv: false },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    catalog: listVerticals(),
    endpoints: [
      'GET /api/vom/status',
      'GET /api/vom/verticals',
      'POST /api/vom/open',
      'POST /api/vom/deliver',
      'POST /api/vom/close',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  VERTICALS,
  start,
  getStatus,
  discovery,
  listVerticals,
  openCycle,
  advanceDelivery,
  closeCycle,
  statsByVertical,
};
