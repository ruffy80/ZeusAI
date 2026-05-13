// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
// unicornTreasury.js — Modul suprem de monetizare & venit
// FAZA 2 / VAL 3 (consolidare supremă)
//
// SURSE absorbite (Grupa D — monetization mesh):
//   - autoRevenue, autonomous-wealth-engine
//   - billing-engine, billion-scale-revenue-engine, tenant-billing, tenantBilling
//   - btcInvoiceLedger, btcPaymentVerifier, nowPayments, paymentGateway, paymentSystems
//   - quantumPaymentNexus, sovereignRevenueRouter
//   - dynamic-pricing, live-pricing-broker
//   - carbonExchange, globalEnergyCarbonTrader, globalMonetizationMesh
//   - creditSystem, referralEngine
//   - ai-marketplace, serviceMarketplace, universalAITrainingMarketplace
//   - checkout-recovery-agent, owner-revenue-dashboard
//   - profit-attribution, profit-control-loop
//   - revenueModules
//
// Strategy: facade-composition.
// Modulele "live" (dynamic-pricing, live-pricing-broker, btcInvoiceLedger,
// btcPaymentVerifier, paymentGateway, nowPayments, ai-marketplace,
// serviceMarketplace, owner-revenue-dashboard, checkout-recovery-agent)
// rămân pe disc — sunt re-exportate aici cu sub-componente strânse.
// Sub-modulele dormante au fost mutate în *.legacy.bak și sunt accesibile
// prin shim-uri thin care delegă către acest modul.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const LEDGER_DIR = path.resolve(__dirname, '..', '..', 'data', 'treasury');
const LEDGER_PATH = path.join(LEDGER_DIR, 'revenue-ledger.json');
const MAIN_INTERVAL = 60000; // 60s

const treasuryBus = new EventEmitter();

function safeRequire(name) {
  try { return require('./' + name); } catch (_) { return null; }
}

// ---- Composed engines (live modules kept as authoritative implementation) ----
const dynamicPricing      = safeRequire('dynamic-pricing');
const livePricingBroker   = safeRequire('live-pricing-broker');
const btcInvoiceLedger    = safeRequire('btcInvoiceLedger');
const btcPaymentVerifier  = safeRequire('btcPaymentVerifier');
const paymentGateway      = safeRequire('paymentGateway');
const nowPayments         = safeRequire('nowPayments');
const aiMarketplace       = safeRequire('ai-marketplace');
const serviceMarketplace  = safeRequire('serviceMarketplace');
const ownerRevenueDash    = safeRequire('owner-revenue-dashboard');
const checkoutRecovery    = safeRequire('checkout-recovery-agent');

// ---- State ----
const state = {
  startedAt: new Date().toISOString(),
  cycles: 0,
  totalUsd: 0,
  totalBtc: 0,
  events: 0,
  history: [],
  active: true,
};

function ensureLedger() {
  try {
    if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });
    if (!fs.existsSync(LEDGER_PATH)) fs.writeFileSync(LEDGER_PATH, JSON.stringify({ events: [] }, null, 2));
  } catch (_) { /* silent */ }
}
function appendLedger(entry) {
  try {
    ensureLedger();
    const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8') || '{"events":[]}');
    data.events.push(Object.assign({ at: new Date().toISOString() }, entry));
    if (data.events.length > 5000) data.events = data.events.slice(-5000);
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2));
  } catch (_) { /* silent */ }
}

// ---- Sub-component: revenueEngine (autoRevenue + billing + wealth-engine) ----
const revenueEngine = {
  getStatus() {
    return {
      name: 'revenueEngine',
      totalUsd: state.totalUsd,
      totalBtc: state.totalBtc,
      events: state.events,
    };
  },
  recordSale(amountUsd, opts = {}) {
    const u = Number(amountUsd) || 0;
    state.totalUsd += u;
    state.events += 1;
    const ev = { type: 'sale', amountUsd: u, currency: opts.currency || 'USD', meta: opts.meta || {} };
    appendLedger(ev);
    treasuryBus.emit('treasury:sale', ev);
    return { ok: true, recorded: u };
  },
  recordBtc(amountBtc, opts = {}) {
    const b = Number(amountBtc) || 0;
    state.totalBtc += b;
    state.events += 1;
    const ev = { type: 'btc_received', amountBtc: b, txid: opts.txid || null };
    appendLedger(ev);
    treasuryBus.emit('treasury:btc', ev);
    return { ok: true, recorded: b };
  },
};

// ---- Sub-component: paymentRouter (paymentGateway+nowPayments+quantumPaymentNexus+sovereignRevenueRouter) ----
const paymentRouter = {
  getStatus() {
    return {
      name: 'paymentRouter',
      gateways: {
        paymentGateway: !!paymentGateway,
        nowPayments: !!nowPayments,
        btcInvoiceLedger: !!btcInvoiceLedger,
        btcPaymentVerifier: !!btcPaymentVerifier,
      },
    };
  },
  async route(intent) {
    // sovereign default: BTC self-custody
    if (intent && intent.preferBTC !== false && btcInvoiceLedger && typeof btcInvoiceLedger.createInvoice === 'function') {
      try {
        const inv = await btcInvoiceLedger.createInvoice(intent);
        treasuryBus.emit('treasury:invoice', inv);
        return { ok: true, channel: 'btc', invoice: inv };
      } catch (e) { /* fall through */ }
    }
    if (paymentGateway && typeof paymentGateway.charge === 'function') {
      try {
        const r = await paymentGateway.charge(intent);
        return { ok: !!r.ok, channel: 'gateway', result: r };
      } catch (e) { return { ok: false, error: String(e.message || e) }; }
    }
    return { ok: false, error: 'no_payment_channel_available' };
  },
};

// ---- Sub-component: pricingMesh (dynamic-pricing + live-pricing-broker) ----
const pricingMesh = {
  getStatus() {
    return {
      name: 'pricingMesh',
      dynamicPricing: !!dynamicPricing,
      livePricingBroker: !!livePricingBroker,
    };
  },
  resolve(serviceId, ctx = {}) {
    try {
      if (dynamicPricing && typeof dynamicPricing.resolvePrice === 'function') {
        return dynamicPricing.resolvePrice(serviceId, ctx);
      }
      if (dynamicPricing && typeof dynamicPricing.getPrice === 'function') {
        return dynamicPricing.getPrice(serviceId, ctx);
      }
    } catch (_) { /* silent */ }
    return { serviceId, priceUsd: 99, fallback: true };
  },
  snapshot() {
    try {
      if (livePricingBroker && typeof livePricingBroker.snapshot === 'function') return livePricingBroker.snapshot();
    } catch (_) { /* silent */ }
    return { items: [], at: new Date().toISOString() };
  },
};

// ---- Sub-component: marketplaceHub (ai-marketplace + serviceMarketplace + universal training) ----
const marketplaceHub = {
  getStatus() {
    return {
      name: 'marketplaceHub',
      aiMarketplace: !!aiMarketplace,
      serviceMarketplace: !!serviceMarketplace,
    };
  },
  listOffers() {
    const offers = [];
    try {
      if (serviceMarketplace && typeof serviceMarketplace.list === 'function') {
        offers.push(...(serviceMarketplace.list() || []));
      }
    } catch (_) { /* silent */ }
    return offers;
  },
};

// ---- Sub-component: carbonExchange (carbon trading + energy) ----
const carbonExchangeFacade = {
  getStatus() { return { name: 'carbonExchange', active: false, shim: true }; },
  trade(/* opts */) { return { ok: false, reason: 'absorbed_into_unicornTreasury' }; },
};

// ---- Sub-component: profitAttribution (profit-attribution + profit-control-loop) ----
const profitAttribution = {
  getStatus() {
    return {
      name: 'profitAttribution',
      totalUsd: state.totalUsd,
      totalBtc: state.totalBtc,
    };
  },
  attribute(eventType, amount, source) {
    const ev = { type: 'attribution', eventType, amount: Number(amount) || 0, source };
    appendLedger(ev);
    treasuryBus.emit('treasury:attribution', ev);
    return { ok: true };
  },
};

// ---- Sub-component: referral (referralEngine + creditSystem) ----
const referralEngine = {
  getStatus() { return { name: 'referralEngine', active: true, mode: 'mesh' }; },
  register(/* user */) { return { ok: true, code: 'REF-' + Math.random().toString(36).slice(2, 10).toUpperCase() }; },
};

// ---- Sub-component: ownerDashboard ----
const ownerDashboard = {
  getStatus() {
    if (ownerRevenueDash && typeof ownerRevenueDash.getStatus === 'function') {
      try { return ownerRevenueDash.getStatus(); } catch (_) { /* silent */ }
    }
    return { name: 'ownerDashboard', totalUsd: state.totalUsd, totalBtc: state.totalBtc };
  },
};

// ---- Sub-component: checkoutRecovery (already exists) ----
const checkoutRecoveryFacade = {
  getStatus() {
    if (checkoutRecovery && typeof checkoutRecovery.getStatus === 'function') {
      try { return checkoutRecovery.getStatus(); } catch (_) { /* silent */ }
    }
    return { name: 'checkout-recovery-agent', active: !!checkoutRecovery };
  },
};

// ---- Main cycle ----
function tick() {
  state.cycles += 1;
  treasuryBus.emit('treasury:tick', { cycle: state.cycles, totalUsd: state.totalUsd, totalBtc: state.totalBtc });
}

let interval = null;
function start() {
  if (interval) return;
  ensureLedger();
  interval = setInterval(tick, MAIN_INTERVAL);
  if (interval && typeof interval.unref === 'function') interval.unref();
  setTimeout(tick, 3000).unref?.();
}
start();

// ---- Public API ----
function getStatus() {
  return {
    name: 'unicornTreasury',
    startedAt: state.startedAt,
    cycles: state.cycles,
    totalUsd: state.totalUsd,
    totalBtc: state.totalBtc,
    events: state.events,
    active: state.active,
    composed: {
      dynamicPricing: !!dynamicPricing,
      livePricingBroker: !!livePricingBroker,
      btcInvoiceLedger: !!btcInvoiceLedger,
      btcPaymentVerifier: !!btcPaymentVerifier,
      paymentGateway: !!paymentGateway,
      nowPayments: !!nowPayments,
      aiMarketplace: !!aiMarketplace,
      serviceMarketplace: !!serviceMarketplace,
      ownerRevenueDash: !!ownerRevenueDash,
      checkoutRecovery: !!checkoutRecovery,
    },
  };
}

module.exports = {
  // Public
  getStatus,
  start,
  // Mesh
  getBus: () => treasuryBus,
  // Sub-components
  revenueEngine,
  paymentRouter,
  pricingMesh,
  marketplaceHub,
  carbonExchange: carbonExchangeFacade,
  profitAttribution,
  referralEngine,
  ownerDashboard,
  checkoutRecovery: checkoutRecoveryFacade,
  // Re-exports for compat
  dynamicPricing,
  livePricingBroker,
  btcInvoiceLedger,
  btcPaymentVerifier,
  paymentGateway,
  nowPayments,
  aiMarketplace,
  serviceMarketplace,
};
