// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T11:58:17.533Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// live-pricing-broker.js
// Additive live-pricing broker that combines:
//   - serviceMarketplace.getAllServices()  → catalogue
//   - dynamicPricing.getPrice(id)          → AI-negotiated USD price per service
//   - paymentGateway.getBitcoinRate()      → live BTC/USD rate (refresh 60s)
// and publishes a unified snapshot consumable both as a JSON pull
// (GET /api/pricing/live) and a Server-Sent-Events push stream
// (GET /api/pricing/live/stream).
//
// This module is strictly ADDITIVE — it does not replace, mutate or hide
// any existing endpoint or payload shape. It is safe to disable via
// LIVE_PRICING_DISABLED=1 (broker becomes a no-op).
// =====================================================================
'use strict';

const EventEmitter = require('events');

// Lazy/defensive requires so a missing dep can never crash boot.
let marketplace = null;
let dynamicPricing = null;
let paymentGateway = null;
let aiNegotiator = null;
try { marketplace    = require('./serviceMarketplace'); } catch (_) {}
try { dynamicPricing = require('./dynamic-pricing'); }   catch (_) {}
try { paymentGateway = require('./paymentGateway'); }    catch (_) {}
try { aiNegotiator   = require('./aiNegotiator'); }      catch (_) {}

const REFRESH_MS = Number(process.env.LIVE_PRICING_REFRESH_MS || 60_000); // 1 min
const SATS_PER_BTC = 100_000_000;

class LivePricingBroker extends EventEmitter {
  constructor() {
    super();
    // NOTE: `cache` / `cacheTTL` are intentionally retained on the instance.
    // The legacy generator (generate_unicorn_final.js) injects exactly these
    // two assignments after every literal `constructor()` to attach an in-memory
    // cache contract. Keeping them here makes the file stable across any
    // future regeneration pass (otherwise the regenerator silently rewrites
    // the constructor and breaks the syntax). They are also reserved for the
    // upcoming local snapshot caching path; the broker currently caches the
    // snapshot in `_snapshot` directly.
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.setMaxListeners(0);
    this._snapshot = {
      btcRate: { rate: 0, currency: 'USD', source: 'init', updatedAt: null },
      services: [],
      negotiator: { total: 0, active: 0, completed: 0, expired: 0 },
      updatedAt: new Date().toISOString(),
      refreshMs: REFRESH_MS,
    };
    this._timer = null;
    this._refreshing = false;
  }

  getSnapshot() { return this._snapshot; }

  subscribe(cb) {
    this.on('snapshot', cb);
    // immediate hydration
    try { cb(this._snapshot); } catch (_) {}
    return () => this.off('snapshot', cb);
  }

  async _refresh() {
    if (this._refreshing) return;
    this._refreshing = true;
    try {
      // 1) BTC rate (live, with built-in fallback in paymentGateway)
      let btcRate = this._snapshot.btcRate;
      if (paymentGateway && typeof paymentGateway.getBitcoinRate === 'function') {
        try { btcRate = await paymentGateway.getBitcoinRate(); } catch (_) { /* keep last */ }
      }
      const rate = Number(btcRate && btcRate.rate) || 0;

      // 2) Catalogue snapshot
      const services = [];
      const seen = new Set();

      // 2a) From the marketplace registry (primary source of truth for the UI)
      if (marketplace && typeof marketplace.getAllServices === 'function') {
        try {
          for (const s of marketplace.getAllServices()) {
            const id = String(s.id);
            seen.add(id);
            const dp = dynamicPricing && typeof dynamicPricing.getPrice === 'function'
              ? safeGetPrice(dynamicPricing, id)
              : null;
            const usd = dp && Number.isFinite(dp.finalPrice) ? dp.finalPrice : Number(s.price) || 0;
            services.push(buildEntry({
              id, name: s.name, category: s.category, description: s.description,
              basePrice: dp ? dp.basePrice : (Number(s.basePrice) || usd),
              usd, dp, rate,
            }));
          }
        } catch (_) { /* swallow */ }
      }

      // 2b) From the dynamic-pricing engine (plans like starter/pro/enterprise)
      if (dynamicPricing && dynamicPricing.BASE_PRICES) {
        for (const id of Object.keys(dynamicPricing.BASE_PRICES)) {
          if (seen.has(id)) continue;
          const dp = safeGetPrice(dynamicPricing, id);
          if (!dp) continue;
          services.push(buildEntry({
            id, name: prettyName(id), category: 'Plan',
            description: `Live-priced ${prettyName(id)} plan`,
            basePrice: dp.basePrice,
            usd: dp.finalPrice,
            dp, rate,
          }));
        }
      }

      // 3) Negotiator stats (informational)
      let negotiator = this._snapshot.negotiator;
      if (aiNegotiator && typeof aiNegotiator.getStats === 'function') {
        try { negotiator = aiNegotiator.getStats(); } catch (_) {}
      }

      this._snapshot = {
        btcRate,
        services,
        negotiator,
        updatedAt: new Date().toISOString(),
        refreshMs: REFRESH_MS,
      };
      this.emit('snapshot', this._snapshot);
    } finally {
      this._refreshing = false;
    }
  }

  start() {
    if (this._timer || process.env.LIVE_PRICING_DISABLED === '1') return;
    // initial async refresh
    this._refresh().catch(() => {});
    this._timer = setInterval(() => { this._refresh().catch(() => {}); }, REFRESH_MS);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
}

function safeGetPrice(dp, id) {
  try { return dp.getPrice(id); } catch (_) { return null; }
}

function prettyName(id) {
  return String(id)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildEntry({ id, name, category, description, basePrice, usd, dp, rate }) {
  const safeUsd = Math.max(0, Math.round(Number(usd) * 100) / 100);
  const btc = rate > 0 ? Math.round((safeUsd / rate) * 1e8) / 1e8 : null; // 8-decimal BTC
  const sats = rate > 0 ? Math.round((safeUsd / rate) * SATS_PER_BTC) : null;
  const baseNum = Number(basePrice) || safeUsd;
  const deltaPct = baseNum > 0
    ? Math.round(((safeUsd - baseNum) / baseNum) * 1000) / 10
    : 0;
  return {
    id,
    name,
    category: category || 'AI',
    description: description || '',
    basePrice: baseNum,
    usd: safeUsd,
    btc,
    sats,
    deltaPct,
    demandFactor: dp ? dp.demandFactor : null,
    surgeActive: dp ? dp.surgeActive : null,
    discountApplied: dp ? dp.discountApplied : null,
    peakHours: dp ? dp.peakHours : null,
    serviceFactor: dp ? dp.serviceFactor : null,
    currency: 'USD',
    btcCurrency: 'BTC',
    updatedAt: new Date().toISOString(),
  };
}

const broker = new LivePricingBroker();
broker.start();
module.exports = broker;
