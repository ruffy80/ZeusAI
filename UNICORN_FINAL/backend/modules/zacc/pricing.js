// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 4 — Dynamic Pricing & Offer Engine.
// RO: rulează de 6 ori pe zi. Ajustează prețul fiecărui produs activ pe baza
// cererii (click/coș/cumpărări), a marjei minime configurate și a conversiei.
// Generează oferte personalizate per vizitator. Reutilizează motorul global
// dynamic-pricing pentru coerență cu restul site-ului.

'use strict';

const { clamp, round2, now, logger } = require('./util');

const log = logger('pricing');

const REPRICE_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4h => 6x/day
const MIN_MARGIN_PCT = Number(process.env.ZACC_MIN_MARGIN_PCT || 25);
const TARGET_CONVERSION = Number(process.env.ZACC_TARGET_CONVERSION || 0.02); // 2%

class PricingEngine {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.lastRepriceAt = 0;
    this.repriceCount = 0;
    this.history = []; // recent reprice decisions
    this.maxHistory = 200;
  }

  dueForReprice() {
    return Date.now() - this.lastRepriceAt >= REPRICE_INTERVAL_MS;
  }

  // Demand index 0..1 from a product's 24h-ish metrics.
  _demandIndex(p) {
    const m = p.metrics || {};
    const views = m.views || 0;
    const carts = m.carts || 0;
    const sales = m.sales || 0;
    const raw = views * 0.02 + carts * 0.15 + sales * 0.6;
    return clamp(raw / 25, 0, 1);
  }

  _conversion(p) {
    const m = p.metrics || {};
    if (!m.views) return null;
    return (m.sales || 0) / m.views;
  }

  // Reprice every active product. Returns the list of decisions made.
  reprice(products, force) {
    if (!force && !this.dueForReprice()) return [];
    const list = Array.isArray(products) ? products : [];
    const decisions = [];
    let dpe = null;
    try { dpe = require('../dynamic-pricing'); } catch (_) { dpe = null; }

    for (const p of list) {
      const base = Number(p.basePriceUsd) || Number(p.priceUsd) || 0;
      if (base <= 0) continue;
      const demand = this._demandIndex(p);
      const conv = this._conversion(p);

      // Base move from the shared engine (keeps surge/discount coherent).
      let engineFactor = 1;
      if (dpe && typeof dpe.getPrice === 'function') {
        try {
          const q = dpe.getPrice(p.id, { basePrice: base });
          const f = Number(q && q.finalPrice);
          if (Number.isFinite(f) && f > 0) engineFactor = f / base;
        } catch (_) { /* keep 1 */ }
      }

      // Demand tilt: +/- up to 18% around the engine quote.
      let factor = engineFactor * (0.91 + demand * 0.27);

      // Conversion correction: if below target, discount 5% and test; if well
      // above target, recover up to 4%.
      let testing = false;
      if (conv != null) {
        if (conv < TARGET_CONVERSION) { factor *= 0.95; testing = true; }
        else if (conv > TARGET_CONVERSION * 2) { factor *= 1.04; }
      }

      let newPrice = round2(base * factor);

      // Enforce the configured minimum margin floor.
      const cost = base * (1 - MIN_MARGIN_PCT / 100);
      const floor = round2(cost / (1 - MIN_MARGIN_PCT / 100));
      if (newPrice < floor) newPrice = floor;

      const prev = Number(p.priceUsd) || base;
      p.priceUsd = newPrice;
      if (p.checkout) p.checkout.priceUsd = newPrice;

      const decision = {
        productId: p.id, base, prev, priceUsd: newPrice,
        demand: round2(demand), conversion: conv != null ? round2(conv) : null,
        testing, changedPct: prev ? round2(((newPrice - prev) / prev) * 100) : 0,
        at: now(),
      };
      decisions.push(decision);
    }

    this.history = decisions.concat(this.history).slice(0, this.maxHistory);
    this.lastRepriceAt = Date.now();
    this.repriceCount += 1;
    if (decisions.length) log.info('repriced', decisions.length, 'products (cycle', this.repriceCount + ')');
    return decisions;
  }

  // Personalized offer for a visitor context: { referrer, device, geo, returning }.
  offerFor(product, visitor) {
    const v = visitor || {};
    const base = Number(product.priceUsd) || Number(product.basePriceUsd) || 0;
    let discountPct = 0;
    const reasons = [];
    if (v.returning) { discountPct += 5; reasons.push('returning-visitor'); }
    if (v.referrer && /reddit|hn|producthunt|github/i.test(String(v.referrer))) { discountPct += 4; reasons.push('community-referral'); }
    if (v.device === 'mobile') { discountPct += 2; reasons.push('mobile-nudge'); }
    if (String(v.geo || '').toUpperCase() === 'EU' && base < 50) { discountPct += 3; reasons.push('eu-sub50'); }
    discountPct = clamp(discountPct, 0, 15);
    // Never break the margin floor.
    const minPrice = round2(base * (1 - MIN_MARGIN_PCT / 200)); // soft floor
    const offerPrice = round2(Math.max(minPrice, base * (1 - discountPct / 100)));
    return {
      productId: product.id,
      basePriceUsd: base,
      offerPriceUsd: offerPrice,
      discountPct: round2(discountPct),
      reasons,
      expiresInMin: 30,
      at: now(),
    };
  }

  status() {
    return {
      ok: true,
      repriceCount: this.repriceCount,
      lastRepriceAt: this.lastRepriceAt ? new Date(this.lastRepriceAt).toISOString() : null,
      intervalHours: REPRICE_INTERVAL_MS / 3_600_000,
      minMarginPct: MIN_MARGIN_PCT,
      targetConversion: TARGET_CONVERSION,
      recent: this.history.slice(0, 6),
    };
  }
}

module.exports = { PricingEngine, REPRICE_INTERVAL_MS };
