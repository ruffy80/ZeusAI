'use strict';

/**
 * Attention→Revenue Continuum — ARC/1.0
 * Bridges social attention ledger events into real catalog offer mints + checkout hooks.
 * Never invents GMV — only mints offers that still need BTC checkout to convert.
 */

const path = require('path');
const {
  isoNow, sha256, moduleDir, readJson, writeJson, ringPush,
} = require('./_util');

const PROTOCOL = 'ARC/1.0';
const NAME = 'attention-revenue-continuum';

const state = {
  startedAt: null,
  running: false,
  attentionEvents: 0,
  offersMinted: 0,
  checkoutsLinked: 0,
  conversionsObserved: 0,
};

/** @type {object[]} */
const _events = [];
/** @type {Map<string, object>} */
const _offers = new Map();
/** @type {object[]} */
const _conversions = [];

function storeFile() {
  return path.join(moduleDir(NAME), 'continuum.json');
}

function persist() {
  writeJson(storeFile(), {
    state,
    events: _events.slice(-300),
    offers: [..._offers.values()].slice(-200),
    conversions: _conversions.slice(-100),
  });
}

function load() {
  const data = readJson(storeFile(), null);
  if (!data) return;
  if (data.state) Object.assign(state, data.state);
  for (const e of data.events || []) _events.push(e);
  for (const o of data.offers || []) {
    if (o && o.offerId) _offers.set(o.offerId, o);
  }
  for (const c of data.conversions || []) _conversions.push(c);
}

load();

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

function _pickSku(weight) {
  // Curated instant SKUs only — never require backend/index (circular).
  const pool = [
    { serviceId: 'instant-seo-content-pack', priceUsd: 49, minWeight: 1 },
    { serviceId: 'instant-ai-ops-audit', priceUsd: 99, minWeight: 3 },
    { serviceId: 'instant-pitch-deck', priceUsd: 149, minWeight: 5 },
  ];
  const w = Number(weight || 1);
  const eligible = pool.filter((p) => w >= p.minWeight);
  return eligible[eligible.length - 1] || pool[0];
}

/**
 * Record attention spend from social continuum and optionally mint an offer.
 */
function recordAttention(input = {}) {
  start();
  const actorId = String(input.actorId || input.userId || 'anon').slice(0, 64);
  const weight = Math.max(0, Number(input.weight || input.attention || 1));
  const channel = String(input.channel || 'zeusai-social').slice(0, 64);
  const subject = String(input.subject || input.contentId || '').slice(0, 128);

  const event = {
    protocol: PROTOCOL,
    eventId: 'att_' + sha256(actorId + isoNow() + Math.random()).slice(0, 14),
    actorId,
    weight,
    channel,
    subject,
    at: isoNow(),
  };
  ringPush(_events, event, 300);
  state.attentionEvents += 1;

  let offer = null;
  if (weight >= 1 && input.mintOffer !== false) {
    const sku = _pickSku(weight);
    const offerId = 'arc_' + sha256(actorId + sku.serviceId + event.eventId).slice(0, 14);
    offer = {
      protocol: PROTOCOL,
      offerId,
      actorId,
      serviceId: sku.serviceId,
      priceUsd: sku.priceUsd,
      sourceEventId: event.eventId,
      channel,
      status: 'minted',
      live: false,
      bookedRevenue: false,
      checkoutPath: `/checkout?serviceId=${encodeURIComponent(sku.serviceId)}&src=arc&offer=${offerId}`,
      apiCheckout: {
        method: 'POST',
        path: '/api/checkout/create',
        body: { serviceId: sku.serviceId, qty: 1, email: input.email || undefined, meta: { arcOfferId: offerId } },
      },
      mintedAt: isoNow(),
      note: 'Offer minted from attention — conversion requires real BTC checkout',
    };
    _offers.set(offerId, offer);
    state.offersMinted += 1;
  }

  persist();
  return { ok: true, event, offer };
}

function linkCheckout(input = {}) {
  const offerId = String(input.offerId || '').trim();
  const orderId = String(input.orderId || '').trim();
  const offer = _offers.get(offerId);
  if (!offer) return { ok: false, reason: 'offer_not_found' };
  if (!orderId) return { ok: false, reason: 'missing_orderId' };
  offer.status = 'checkout_linked';
  offer.orderId = orderId;
  offer.linkedAt = isoNow();
  _offers.set(offerId, offer);
  state.checkoutsLinked += 1;
  persist();
  return { ok: true, offer };
}

function observeConversion(input = {}) {
  const offerId = String(input.offerId || '').trim();
  const orderId = String(input.orderId || '').trim();
  const amountUsd = Number(input.amountUsd || 0);
  const offer = offerId ? _offers.get(offerId) : null;
  if (offer) {
    offer.status = 'converted';
    offer.convertedAt = isoNow();
    offer.amountUsd = amountUsd || offer.priceUsd;
    offer.live = true;
    // still not inventing — only observe a paid order id
    offer.bookedRevenue = !!orderId;
    _offers.set(offerId, offer);
  }
  const row = {
    at: isoNow(),
    offerId: offerId || null,
    orderId: orderId || null,
    amountUsd: amountUsd || (offer && offer.priceUsd) || 0,
    observed: true,
    invented: false,
  };
  ringPush(_conversions, row, 100);
  state.conversionsObserved += 1;
  persist();
  return { ok: true, conversion: row, offer };
}

function listOffers(limit = 50) {
  return [..._offers.values()]
    .sort((a, b) => String(b.mintedAt).localeCompare(String(a.mintedAt)))
    .slice(0, Math.min(200, Number(limit) || 50));
}

function getStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Attention→Revenue Continuum',
    running: !!state.running,
    startedAt: state.startedAt,
    counts: {
      attentionEvents: state.attentionEvents,
      offersMinted: state.offersMinted,
      checkoutsLinked: state.checkoutsLinked,
      conversionsObserved: state.conversionsObserved,
      openOffers: [..._offers.values()].filter((o) => o.status === 'minted').length,
    },
    honesty: {
      inventsGmv: false,
      note: 'Offers require /api/checkout/create + paid BTC to convert',
    },
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/arc/status',
      'GET /api/arc/offers',
      'POST /api/arc/attention',
      'POST /api/arc/link-checkout',
      'POST /api/arc/convert',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  discovery,
  recordAttention,
  linkCheckout,
  observeConversion,
  listOffers,
};
