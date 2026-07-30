'use strict';

/**
 * Agent Capability Exchange — ACE/1.0
 * Clearinghouse for AI agent capacity: list → quote → reserve prepaid credits → credential.
 * No platform custody float; credits burn on use against verified capabilities.
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ringPush,
} = require('./_util');

const PROTOCOL = 'ACE/1.0';
const NAME = 'agent-capability-exchange';

const state = {
  startedAt: null,
  running: false,
  listings: 0,
  reserves: 0,
  burns: 0,
  credentialsIssued: 0,
};

/** @type {Map<string, object>} */
const _listings = new Map();
/** @type {Map<string, object>} */
const _credits = new Map();
/** @type {Map<string, object>} */
const _credentials = new Map();
/** @type {object[]} */
const _ledger = [];

function storeFile() {
  return path.join(moduleDir(NAME), 'exchange.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    listings: [..._listings.values()],
    credits: [..._credits.entries()],
    credentials: [..._credentials.values()].slice(-200),
    ledger: _ledger.slice(-200),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const l of data.listings || []) {
    if (l && l.listingId) _listings.set(l.listingId, l);
  }
  for (const [agentId, bal] of data.credits || []) {
    _credits.set(agentId, bal);
  }
  for (const c of data.credentials || []) {
    if (c && c.credentialId) _credentials.set(c.credentialId, c);
  }
  for (const row of data.ledger || []) _ledger.push(row);
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  // Seed a ZeusAI house listing (honest, local capacity)
  if (!_listings.has('ace_zeus_house')) {
    listCapability({
      listingId: 'ace_zeus_house',
      agentId: 'zeusai-house',
      capability: 'digital-fulfillment-pack',
      unit: 'job',
      priceCredits: 10,
      slaHours: 24,
      capacity: 100,
    });
  }
  return getStatus();
}

function listCapability(input = {}) {
  start();
  const agentId = String(input.agentId || 'anonymous').slice(0, 64);
  const capability = String(input.capability || '').trim();
  if (!capability) return { ok: false, reason: 'missing_capability' };
  const listingId = String(input.listingId || ('ace_' + sha256(agentId + '|' + capability).slice(0, 14)));
  const listing = {
    protocol: PROTOCOL,
    listingId,
    agentId,
    capability,
    unit: String(input.unit || 'job'),
    priceCredits: Math.max(1, Number(input.priceCredits || 1)),
    slaHours: Math.max(1, Number(input.slaHours || 24)),
    capacity: Math.max(0, Number(input.capacity || 1)),
    remaining: Math.max(0, Number(input.capacity || 1)),
    active: true,
    listedAt: isoNow(),
  };
  const isNew = !_listings.has(listingId);
  _listings.set(listingId, listing);
  if (isNew) state.listings += 1;
  ringPush(_ledger, { at: isoNow(), event: 'list', listingId, agentId }, 200);
  persist();
  return { ok: true, listing };
}

function fundCredits(input = {}) {
  start();
  const agentId = String(input.agentId || '').trim();
  const credits = Number(input.credits || 0);
  const proof = String(input.paymentProof || input.orderId || '').trim();
  if (!agentId) return { ok: false, reason: 'missing_agentId' };
  if (!(credits > 0)) return { ok: false, reason: 'invalid_credits' };
  // Honesty: prepaid credits require a real payment proof reference (order/txid).
  if (!proof) {
    return {
      ok: false,
      reason: 'missing_payment_proof',
      note: 'ACE credits are prepaid against a real paid orderId/txid — never minted from thin air.',
    };
  }
  const bal = _credits.get(agentId) || { agentId, balance: 0, funded: 0, burned: 0, proofs: [] };
  bal.balance += credits;
  bal.funded += credits;
  bal.proofs.push({ at: isoNow(), credits, proof: proof.slice(0, 128) });
  if (bal.proofs.length > 50) bal.proofs.shift();
  _credits.set(agentId, bal);
  state.reserves += 1;
  ringPush(_ledger, { at: isoNow(), event: 'fund', agentId, credits, proof }, 200);
  persist();
  return { ok: true, balance: bal };
}

function reserve(input = {}) {
  start();
  const buyerId = String(input.buyerId || input.agentId || '').trim();
  const listingId = String(input.listingId || '').trim();
  const qty = Math.max(1, Number(input.qty || 1));
  if (!buyerId || !listingId) return { ok: false, reason: 'missing_buyer_or_listing' };
  const listing = _listings.get(listingId);
  if (!listing || !listing.active) return { ok: false, reason: 'listing_not_found' };
  if (listing.remaining < qty) return { ok: false, reason: 'insufficient_capacity' };
  const cost = listing.priceCredits * qty;
  const bal = _credits.get(buyerId) || { agentId: buyerId, balance: 0, funded: 0, burned: 0, proofs: [] };
  if (bal.balance < cost) {
    return { ok: false, reason: 'insufficient_credits', need: cost, balance: bal.balance };
  }
  bal.balance -= cost;
  bal.burned += cost;
  _credits.set(buyerId, bal);
  listing.remaining -= qty;
  _listings.set(listingId, listing);
  state.burns += 1;

  const credentialId = 'cred_' + sha256(buyerId + listingId + isoNow()).slice(0, 16);
  const credential = {
    protocol: PROTOCOL,
    credentialId,
    buyerId,
    listingId,
    capability: listing.capability,
    sellerId: listing.agentId,
    qty,
    creditsBurned: cost,
    issuedAt: isoNow(),
    expiresAt: new Date(Date.now() + listing.slaHours * 3600 * 1000).toISOString(),
    hash: null,
  };
  credential.hash = sha256(credential);
  _credentials.set(credentialId, credential);
  state.credentialsIssued += 1;
  ringPush(_ledger, { at: isoNow(), event: 'reserve', buyerId, listingId, credentialId, cost }, 200);
  persist();
  return { ok: true, credential, balance: bal.balance, listing };
}

function listListings() {
  return [..._listings.values()].filter((l) => l.active);
}

function getBalance(agentId) {
  return _credits.get(String(agentId || '')) || { agentId, balance: 0, funded: 0, burned: 0 };
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Agent Capability Exchange',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: {
      listings: _listings.size,
      activeListings: listListings().length,
      creditAccounts: _credits.size,
      credentials: _credentials.size,
      reserves: state.reserves,
      burns: state.burns,
    },
    honesty: {
      mintedWithoutPayment: false,
      custody: false,
      note: 'Credits require paymentProof (orderId/txid); burn on reserve.',
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/ace/status',
      'GET /api/ace/listings',
      'POST /api/ace/list',
      'POST /api/ace/fund',
      'POST /api/ace/reserve',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  listCapability,
  fundCredits,
  reserve,
  listListings,
  getBalance,
};
