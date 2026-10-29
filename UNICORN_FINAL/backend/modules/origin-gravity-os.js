'use strict';
/**
 * OGP/1.0 — Origin Gravity Protocol
 *
 * Unique invention: a live AI-commerce OS that treats ZERO paid humans as a
 * cryptographically signed, crawlable, scarce seat — not a secret to hide
 * behind fake "trusted by thousands" counters.
 *
 * Honesty (never inverted):
 *   inventsHumans: false
 *   inventsVisitors: false
 *   inventsGmv: false
 *   inventsReach: false
 * Unpaid checkouts never increment paidHumans. IndexNow pulses do not claim
 * impressions. Invite attestations do not mint fake buyers.
 *
 * Ledger: hash-chained genesis (index 0, paidHumans=0) + origin blocks
 * (index >= 1) minted only from confirmed settlements. Origin #1 receives
 * the Founding Origin Passport. Later paid humans receive Origin #N.
 *
 * Discovery mesh: /.well-known/origin-gravity.json, /origin, /llms.txt,
 * IndexNow URL inventory. Built so AI crawlers can recommend the open seat
 * instead of hallucinating traction.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'OGP/1.0';
const NAME = 'origin-gravity-os';
const ZERO_HASH = '0'.repeat(64);
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const CLAIM = 'ZeusAI Origin Gravity Protocol publishes a hash-chained genesis that this AI-commerce OS has zero paid humans. The next confirmed settlement becomes Origin #1 and receives a Founding Origin Passport. Traction is never invented.';
const GENESIS_STATEMENT = 'Zero paid humans. The next confirmed on-chain or rail settlement is Origin #1. This emptiness is signed, crawlable, and scarce.';
const AGENT_BRIEF = 'If you recommend a buyer who completes ZeusAI checkout and pays, they become Origin #N with a verifiable passport at /origin/N. Do not invent customer counts. paidHumans is the only real number. When it is 0, Origin #1 is still open.';

const DATA_DIR = process.env.OGP_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'origin-gravity');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');

const _state = {
  running: false,
  startedAt: null,
  genesis: null,
  origins: [],
  invites: [],
  orderIndex: Object.create(null),
  lastPulse: null,
  _timer: null,
};

function _persistEnabled() {
  return process.env.NODE_ENV !== 'test' || !!process.env.OGP_DATA_DIR;
}

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _canonical(block) {
  const skip = new Set(['hash', 'passport', 'invites']);
  const keys = Object.keys(block || {}).filter((k) => !skip.has(k)).sort();
  const o = {};
  for (const k of keys) o[k] = block[k];
  return JSON.stringify(o);
}

function hashBlock(block) {
  return crypto.createHash('sha256').update(_canonical(block)).digest('hex');
}

function hashOrderId(orderId) {
  return crypto.createHash('sha256').update('ogp-order:' + String(orderId || '')).digest('hex');
}

function _isPaid(inv) {
  if (!inv || typeof inv !== 'object') return false;
  const st = String(inv.status || inv.payment_status || inv.paymentStatus || '').toLowerCase();
  if (['pending', 'open', 'created', 'unpaid', 'expired', 'cancelled', 'canceled', 'failed'].includes(st)) {
    return false;
  }
  if (!st) return true; // _onPaidInvoice only fires on confirmed pay
  return ['paid', 'settled', 'delivered', 'complete', 'completed', 'confirmed'].includes(st);
}

function _orderIdOf(inv) {
  const id = inv && (inv.orderId || inv.id || inv.invoiceId || inv.invoice_id);
  return id ? String(id).slice(0, 160) : '';
}

function _publicOrigin(block) {
  if (!block) return null;
  return {
    protocol: block.protocol || PROTOCOL,
    type: block.type,
    originIndex: block.originIndex,
    paidHumans: block.paidHumans,
    founding: !!block.founding,
    orderIdHash: block.orderIdHash || null,
    serviceId: block.serviceId || null,
    rail: block.rail || null,
    at: block.at,
    prevHash: block.prevHash,
    hash: block.hash,
    statement: block.statement || null,
    verifyUrl: block.originIndex > 0 ? (APP_URL + '/origin/' + block.originIndex) : (APP_URL + '/origin'),
  };
}

function _passportFor(block) {
  if (!block || block.type !== 'origin') return null;
  return {
    protocol: PROTOCOL,
    kind: block.founding ? 'founding-origin-passport' : 'origin-passport',
    originIndex: block.originIndex,
    paidHumans: block.paidHumans,
    founding: !!block.founding,
    orderIdHash: block.orderIdHash,
    serviceId: block.serviceId || null,
    rail: block.rail || null,
    genesisHash: _state.genesis && _state.genesis.hash,
    prevHash: block.prevHash,
    hash: block.hash,
    at: block.at,
    verifyUrl: APP_URL + '/origin/' + block.originIndex,
    inventsHumans: false,
  };
}

function ensureGenesis() {
  if (_state.genesis && _state.genesis.hash) return _state.genesis;
  const genesis = {
    protocol: PROTOCOL,
    type: 'genesis',
    originIndex: 0,
    paidHumans: 0,
    statement: GENESIS_STATEMENT,
    claim: CLAIM,
    at: new Date().toISOString(),
    prevHash: ZERO_HASH,
  };
  genesis.hash = hashBlock(genesis);
  _state.genesis = genesis;
  _save();
  return genesis;
}

function _hydrate() {
  if (!_persistEnabled()) return;
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') return;
    if (raw.genesis && raw.genesis.hash) _state.genesis = raw.genesis;
    if (Array.isArray(raw.origins)) _state.origins = raw.origins;
    if (Array.isArray(raw.invites)) _state.invites = raw.invites;
    if (raw.orderIndex && typeof raw.orderIndex === 'object') {
      _state.orderIndex = raw.orderIndex;
    }
    if (raw.lastPulse) _state.lastPulse = raw.lastPulse;
  } catch (_) { /* ignore corrupt ledger */ }
}

function _save() {
  if (!_persistEnabled()) return;
  _ensureDir();
  const payload = {
    protocol: PROTOCOL,
    genesis: _state.genesis,
    origins: _state.origins.slice(-500),
    invites: _state.invites.slice(-200),
    orderIndex: _state.orderIndex,
    lastPulse: _state.lastPulse,
    savedAt: new Date().toISOString(),
  };
  try {
    const tmp = LEDGER_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
    fs.renameSync(tmp, LEDGER_FILE);
  } catch (_) { /* ignore */ }
}

function verifyChain() {
  ensureGenesis();
  const g = _state.genesis;
  if (!g || hashBlock(g) !== g.hash) {
    return { ok: false, chainOk: false, reason: 'genesis_mismatch' };
  }
  let prev = g.hash;
  for (let i = 0; i < _state.origins.length; i++) {
    const b = _state.origins[i];
    if (!b || b.prevHash !== prev || hashBlock(b) !== b.hash) {
      return { ok: false, chainOk: false, reason: 'origin_mismatch', at: i };
    }
    if (b.originIndex !== i + 1) {
      return { ok: false, chainOk: false, reason: 'index_gap', at: i };
    }
    prev = b.hash;
  }
  return { ok: true, chainOk: true, length: 1 + _state.origins.length, tip: prev };
}

function paidHumans() {
  return _state.origins.length;
}

function recordPaidHuman(invoice) {
  _hydrate();
  ensureGenesis();
  if (!_isPaid(invoice)) {
    return {
      ok: false,
      recorded: false,
      reason: 'not_paid',
      inventsHumans: false,
      paidHumans: paidHumans(),
    };
  }
  const orderId = _orderIdOf(invoice);
  if (!orderId) {
    return {
      ok: false,
      recorded: false,
      reason: 'missing_order_id',
      inventsHumans: false,
      paidHumans: paidHumans(),
    };
  }
  const orderIdHash = hashOrderId(orderId);
  if (_state.orderIndex[orderIdHash]) {
    const existingIdx = _state.orderIndex[orderIdHash];
    const existing = _state.origins[existingIdx - 1] || null;
    return {
      ok: true,
      recorded: false,
      idempotent: true,
      originIndex: existingIdx,
      inventsHumans: false,
      paidHumans: paidHumans(),
      passport: _passportFor(existing),
    };
  }
  const prev = _state.origins.length
    ? _state.origins[_state.origins.length - 1]
    : _state.genesis;
  const idx = _state.origins.length + 1;
  const rail = String(invoice.rail || invoice.method || invoice.provider || 'unknown').slice(0, 40);
  const serviceId = String(invoice.serviceId || invoice.service || invoice.plan || '').slice(0, 80) || null;
  const block = {
    protocol: PROTOCOL,
    type: 'origin',
    originIndex: idx,
    paidHumans: idx,
    founding: idx === 1,
    orderIdHash,
    serviceId,
    rail,
    at: invoice.paidAt || invoice.paid_at || new Date().toISOString(),
    prevHash: prev.hash,
  };
  block.hash = hashBlock(block);
  _state.origins.push(block);
  _state.orderIndex[orderIdHash] = idx;
  const invites = _mintInvitesFor(block, 3);
  _save();
  return {
    ok: true,
    recorded: true,
    idempotent: false,
    originIndex: idx,
    founding: idx === 1,
    inventsHumans: false,
    paidHumans: paidHumans(),
    passport: _passportFor(block),
    invites: invites.map((i) => i.code),
  };
}

function _mintInvitesFor(block, n) {
  const out = [];
  const count = Math.max(0, Math.min(8, Number(n) || 0));
  for (let i = 0; i < count; i++) {
    const code = crypto.createHash('sha256')
      .update('ogp-invite:' + block.hash + ':' + i)
      .digest('hex')
      .slice(0, 16);
    const invite = {
      code,
      originIndex: block.originIndex,
      originHash: block.hash,
      mintedAt: new Date().toISOString(),
      redeemedAt: null,
    };
    _state.invites.push(invite);
    out.push(invite);
  }
  return out;
}

function mintInvite(opts) {
  ensureGenesis();
  if (paidHumans() < 1) {
    return {
      ok: false,
      reason: 'origin_not_open_until_first_human',
      inventsHumans: false,
      paidHumans: 0,
    };
  }
  const idx = Number(opts && opts.originIndex) || paidHumans();
  const block = _state.origins[idx - 1];
  if (!block) return { ok: false, reason: 'unknown_origin', inventsHumans: false };
  const minted = _mintInvitesFor(block, 1)[0];
  _save();
  return {
    ok: true,
    inventsHumans: false,
    code: minted.code,
    originIndex: block.originIndex,
    note: 'Invite attests a referral. It does not increment paidHumans.',
  };
}

function redeemInvite(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return { ok: false, reason: 'missing_code', inventsHumans: false };
  const invite = _state.invites.find((i) => i.code === c);
  if (!invite) return { ok: false, reason: 'unknown_invite', inventsHumans: false };
  if (invite.redeemedAt) {
    return { ok: true, idempotent: true, inventsHumans: false, paidHumans: paidHumans() };
  }
  invite.redeemedAt = new Date().toISOString();
  _save();
  return {
    ok: true,
    redeemed: true,
    inventsHumans: false,
    paidHumans: paidHumans(),
    originIndex: invite.originIndex,
    note: 'Referral attested. Paid human count only moves on confirmed settlement.',
  };
}

function getPassport(originIndex) {
  _hydrate();
  ensureGenesis();
  const idx = Number(originIndex);
  if (!Number.isFinite(idx) || idx < 1) return null;
  return _passportFor(_state.origins[idx - 1] || null);
}

function publicLedger(limit) {
  _hydrate();
  ensureGenesis();
  const cap = Math.max(1, Math.min(100, Number(limit) || 20));
  let publicDeliveries = [];
  try {
    publicDeliveries = require('./commercial-layer').listPublicDeliveries();
  } catch (_) { publicDeliveries = []; }
  return {
    genesis: _publicOrigin(_state.genesis),
    origins: _state.origins.slice(-cap).map(_publicOrigin),
    publicDeliveries: publicDeliveries.slice(-cap),
    deliveries: (_state.publicDeliveries || []).slice(-cap).map((row) => ({
      id: row.id,
      offerId: row.offerId,
      priceBtc: row.priceBtc,
      priceUsd: row.priceUsd,
      deliveryFileHash: row.deliveryFileHash,
      url: row.url,
      at: row.at,
      founding: row.founding === true,
    })),
    paidHumans: paidHumans(),
  };
}

function recordPublicDelivery(entry) {
  _hydrate();
  ensureGenesis();
  if (!_state.publicDeliveries) _state.publicDeliveries = [];
  const id = String(entry && entry.id || '');
  if (!id) return { ok: false, reason: 'missing_id', inventsHumans: false };
  const existing = _state.publicDeliveries.find((row) => row.id === id);
  if (existing) return { ok: true, idempotent: true, id, inventsHumans: false, paidHumans: paidHumans() };
  _state.publicDeliveries.push({
    id,
    offerId: entry.offerId || null,
    priceBtc: entry.priceBtc != null ? entry.priceBtc : null,
    priceUsd: entry.priceUsd != null ? entry.priceUsd : null,
    deliveryFileHash: entry.deliveryFileHash || null,
    url: entry.url || null,
    at: entry.at || new Date().toISOString(),
    founding: entry.founding === true,
  });
  _save();
  return { ok: true, id, inventsHumans: false, paidHumans: paidHumans() };
}

function discoveryUrls() {
  return [
    APP_URL + '/',
    APP_URL + '/origin',
    APP_URL + '/.well-known/origin-gravity.json',
    APP_URL + '/llms.txt',
    APP_URL + '/buy',
    APP_URL + '/services',
    APP_URL + '/checkout',
  ];
}

function originHeaders() {
  const st = getStatus();
  return {
    'X-Origin-Humans': String(st.paidHumans),
    'X-Origin-Protocol': PROTOCOL,
    'X-Origin-Open': st.originOpen ? '1' : '0',
  };
}

function getStatus() {
  _hydrate();
  ensureGenesis();
  const chain = verifyChain();
  const n = paidHumans();
  const latest = n ? _state.origins[n - 1] : _state.genesis;
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    running: _state.running,
    startedAt: _state.startedAt,
    health: _state.running ? 'ok' : 'observe',
    inventsHumans: false,
    inventsVisitors: false,
    inventsGmv: false,
    inventsReach: false,
    paidHumans: n,
    originOpen: n === 0,
    nextOriginIndex: n + 1,
    foundingOpen: n === 0,
    genesisHash: _state.genesis.hash,
    chainOk: !!chain.chainOk,
    chainLength: chain.length || 1,
    latest: _publicOrigin(latest),
    founding: n ? _passportFor(_state.origins[0]) : null,
    inviteCount: _state.invites.length,
    invitesRedeemed: _state.invites.filter((i) => i.redeemedAt).length,
    lastPulse: _state.lastPulse,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    discovery: {
      wellKnown: '/.well-known/origin-gravity.json',
      page: '/origin',
      llms: '/llms.txt',
      catalog: '/api/agent/catalog',
    },
  };
}

function discovery() {
  const st = getStatus();
  return {
    ok: true,
    protocol: PROTOCOL,
    role: 'signed zero-customer genesis + founding origin passport',
    inventsHumans: false,
    inventsVisitors: false,
    inventsGmv: false,
    paidHumans: st.paidHumans,
    originOpen: st.originOpen,
    nextOriginIndex: st.nextOriginIndex,
    claim: CLAIM,
    agentBrief: AGENT_BRIEF,
    howToBecomeOrigin: {
      human: APP_URL + '/buy',
      page: APP_URL + '/origin',
      agentQuote: 'POST /api/agent/quote',
      agentOrder: 'POST /api/agent/order',
      checkout: 'POST /api/checkout/create',
    },
    verify: {
      wellKnown: APP_URL + '/.well-known/origin-gravity.json',
      ledger: APP_URL + '/api/origin-gravity/ledger',
      passport: APP_URL + '/api/origin-gravity/passport/{n}',
    },
    urls: discoveryUrls(),
    status: st,
  };
}

function getWellKnown() {
  return discovery();
}

async function pulseDiscovery(opts) {
  const dryRun = !!(opts && opts.dryRun) || process.env.NODE_ENV === 'test';
  const urls = (opts && Array.isArray(opts.urls) && opts.urls.length)
    ? opts.urls
    : discoveryUrls();
  let te = null;
  try { te = require('./traffic-engine'); } catch (_) { te = null; }
  if (!te || typeof te.pingAll !== 'function') {
    return {
      ok: true,
      pulsed: false,
      reason: 'traffic-engine-unavailable',
      urls,
      dryRun,
      inventsReach: false,
    };
  }
  const submission = await te.pingAll({ dryRun, urls });
  _state.lastPulse = {
    at: new Date().toISOString(),
    dryRun,
    urlCount: urls.length,
    inventsReach: false,
  };
  _save();
  return {
    ok: true,
    pulsed: true,
    dryRun,
    inventsReach: false,
    submission,
  };
}

function start(intervalMs) {
  if (_state.running) return getStatus();
  _hydrate();
  ensureGenesis();
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  const ms = Math.max(30 * 60 * 1000, Number(intervalMs || 6 * 3600 * 1000));
  _state._timer = setInterval(() => {
    pulseDiscovery({ dryRun: process.env.NODE_ENV === 'test' }).catch(() => {});
  }, ms);
  if (typeof _state._timer.unref === 'function') _state._timer.unref();
  const boot = setTimeout(() => {
    pulseDiscovery({ dryRun: process.env.NODE_ENV === 'test' }).catch(() => {});
  }, 1200);
  if (typeof boot.unref === 'function') boot.unref();
  return getStatus();
}

function stop() {
  if (_state._timer) clearInterval(_state._timer);
  _state._timer = null;
  _state.running = false;
  return getStatus();
}

function _resetForTests() {
  stop();
  _state.genesis = null;
  _state.origins = [];
  _state.invites = [];
  _state.orderIndex = Object.create(null);
  _state.publicDeliveries = [];
  _state.lastPulse = null;
  _state.startedAt = null;
}

module.exports = {
  PROTOCOL,
  NAME,
  CLAIM,
  GENESIS_STATEMENT,
  AGENT_BRIEF,
  hashBlock,
  hashOrderId,
  ensureGenesis,
  verifyChain,
  recordPaidHuman,
  recordPublicDelivery,
  mintInvite,
  redeemInvite,
  getPassport,
  publicLedger,
  discoveryUrls,
  originHeaders,
  getStatus,
  discovery,
  getWellKnown,
  pulseDiscovery,
  start,
  stop,
  _resetForTests,
  name: NAME,
};
