// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Auto Publisher.
// RO: ia produsele scorate de ProfitMaximizer și publică automat top N
// (default 12-20/zi) ca produse listate în site (/dropship + /api/services),
// cu descriere generată AI (când AGI module e disponibil; altfel template
// determinist solid), markup configurabil, pagină dedicată și link BTC.
// Nimic nu blochează bucla autonomă — fail-soft peste tot.

'use strict';

const { OWNER_BTC, now, slug, round2, shortId, logger } = require('./util');
const describe = require('./describe');
const { coverPath } = require('./product-cover');

const log = logger('publisher');

const DAILY_TARGET = Number(process.env.ZACC_PUBLISH_PER_TICK || 4); // per orchestrator tick
const MAX_PUBLISHED = Number(process.env.ZACC_MAX_PUBLISHED || 200);
const REPUBLISH_COOLDOWN_MS = Number(process.env.ZACC_REPUBLISH_MS || 24 * 60 * 60 * 1000);
// Minimum number of products the live storefront must always carry. When the
// live catalogue drops below this floor (e.g. after a state restore that lost
// `published` but kept the cooldown map, or a cold boot), the publisher fills
// it aggressively and IGNORES the republish cooldown so the page is never empty.
const MIN_CATALOG = Math.max(0, Number(process.env.ZACC_MIN_CATALOG || 12));
const AI_DESCRIPTIONS = process.env.ZACC_AI_DESCRIPTIONS !== '0'; // on by default

// Best-effort hook into the existing AGI/AGE module for a richer marketing
// description. If unavailable, falls back to a deterministic template — both
// paths return plausible, on-brand copy.

class AutoPublisher {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.published = [];          // most recent first
    this.byId = new Map();        // id → item (live)
    this.publishedAt = new Map(); // sourceKey → timestamp (for cooldown)
    this.publishes = 0;
    this.lastPublishAt = 0;
    this._sink = null;            // backend-provided publish hook (push into /services)
  }

  setSink(fn) { if (typeof fn === 'function') this._sink = fn; }

  _sourceKey(rawProduct) {
    return [rawProduct.source || 'seed', slug(rawProduct.name || '')].join(':');
  }

  _alreadyRecent(rawProduct) {
    const k = this._sourceKey(rawProduct);
    const t = this.publishedAt.get(k) || 0;
    return Date.now() - t < REPUBLISH_COOLDOWN_MS;
  }

  // Source keys of the products currently LIVE in the catalogue. Used to dedupe
  // so the same product is never listed twice, independent of the time-based
  // cooldown (which can be bypassed when the catalogue is under-filled).
  _liveSourceKeys() {
    const set = new Set();
    for (const p of this.published) set.add(this._sourceKey({ source: p.source, name: p.title }));
    return set;
  }

  // Build a single publishable product from a scored candidate.
  _materialize(scored) {
    const id = 'dropship-' + slug(scored.name) + '-' + shortId('').slice(-6);
    const description = describe.template(scored);
    const costUsd = round2(scored.costUsd);
    const shippingUsd = round2(scored.shippingUsd || 0);
    const priceUsd = round2(scored.retailUsd);
    const netProfitUsd = round2(scored.netProfitUsd);
    const marginPct = round2(scored.marginPct);
    // feeUsd = whatever retail is left over after cost, shipping and net
    // profit — i.e. the processor/handling fees the ProfitMaximizer subtracted.
    const feeUsd = round2(Math.max(0, priceUsd - costUsd - shippingUsd - netProfitUsd));
    // Supplier + logistics metadata carried from the scraper/profit stages.
    const demoOnly = scored.demoOnly === true;
    const supplier = scored.supplier || (scored.source === 'zeus-curated' ? 'manual' : (scored.source || 'unknown'));
    const supplierRef = scored.supplierRef != null ? scored.supplierRef : null;
    const weightKg = Number(scored.weightKg) || 0;
    const originCountry = scored.originCountry || null;
    const hasCj = !!String(process.env.ZACC_CJ_API_KEY || '').trim();
    // Honest delivery mode:
    //  - CJ key + real supplierRef → global CJ dropship
    //  - otherwise → Zeus Fulfillment Desk (durable owner queue; not "fake auto")
    const deliveryMode = (demoOnly || !hasCj)
      ? 'zeus-fulfillment-desk'
      : 'cj-global-dropship';
    const item = {
      id,
      title: scored.name,
      slug: slug(scored.name),
      category: scored.category || 'general',
      source: scored.source || 'seed',
      sourceUrl: scored.url || '',
      image: String(scored.image || '').trim() || coverPath(slug(scored.name)),
      costUsd,
      shippingUsd,
      priceUsd,
      netProfitUsd,
      marginPct,
      profitPotential: round2(scored.profitPotential),
      rating: Number(scored.rating) || 0,
      reviews: Number(scored.reviews) || 0,
      supplier,
      supplierRef,
      demoOnly,
      weightKg,
      originCountry,
      proofOfMargin: { costUsd, shippingUsd, feeUsd, netProfitUsd, marginPct },
      description,
      type: 'physical',
      niche: 'dropship',
      group: 'dropship',
      page: '/dropship/product/' + id,
      buyUrl: '/checkout?serviceId=' + encodeURIComponent(id) + '&plan=' + encodeURIComponent(id),
      checkout: { btcAddress: OWNER_BTC, priceUsd },
      delivery: { mode: deliveryMode, automated: hasCj && !demoOnly, etaDays: '7-21' },
      metrics: { views: 0, carts: 0, sales: 0, revenueUsd: 0, delivered: 0 },
      status: 'active',
      publishedAt: now(),
    };
    return item;
  }

  // Publish up to `limit` of the highest-scoring qualified products. Skips
  // duplicates (already-published source key within the cooldown window).
  //
  // Self-heal: when the live catalogue is below MIN_CATALOG (e.g. a cold boot or
  // a state restore that lost `published` but kept the cooldown map), the
  // publisher fills aggressively up to the floor and bypasses the time-based
  // cooldown — otherwise the storefront could stay empty for a full 24h despite
  // hundreds of scraped + qualified products. Live duplicates are still skipped.
  publish(scoredTop, limit) {
    const underFilled = this.published.length < MIN_CATALOG;
    const baseLimit = Math.max(1, Number(limit) || DAILY_TARGET);
    const max = underFilled
      ? Math.max(baseLimit, MIN_CATALOG - this.published.length)
      : baseLimit;
    const liveKeys = this._liveSourceKeys();
    const added = [];
    for (const cand of (scoredTop || [])) {
      if (added.length >= max) break;
      if (!cand || !cand.name) continue;
      // Never list the same product twice.
      if (liveKeys.has(this._sourceKey(cand))) continue;
      // Respect the republish cooldown only while the catalogue is healthy.
      if (!underFilled && this._alreadyRecent(cand)) continue;
      const item = this._materialize(cand);
      this.published = [item].concat(this.published).slice(0, MAX_PUBLISHED);
      this.byId.set(item.id, item);
      this.publishedAt.set(this._sourceKey(cand), Date.now());
      liveKeys.add(this._sourceKey(cand));
      added.push(item);
      // Seed dynamic pricing for the live price endpoint (best-effort).
      try {
        const dpe = require('../dynamic-pricing');
        if (dpe && typeof dpe.registerService === 'function') {
          dpe.registerService(item.id, item.priceUsd, { force: false });
        }
      } catch (_) { /* optional */ }
      // Push into main catalog sink (so it shows in /api/services + storefront).
      if (this._sink) {
        try { this._sink(item); } catch (e) { log.warn('sink failed:', e.message); }
      }
      // Best-effort: upgrade the template copy to a real AI-written description
      // asynchronously. Mutates the live product object in place; the next page
      // refresh shows the AI copy. Never blocks the autonomous loop.
      if (AI_DESCRIPTIONS) {
        describe.ai(item).then((txt) => {
          if (txt) { item.description = txt; item.aiDescribed = true; }
        }).catch(() => { /* fail-soft */ });
      }
    }
    if (added.length) {
      this.publishes += added.length;
      this.lastPublishAt = Date.now();
      log.info('published', added.length, 'dropship products · total live', this.published.length);
    }
    return added;
  }

  get(id) { return this.byId.get(id) || null; }

  /** Cache-busting revision for ETag / If-None-Match on the products API. */
  revision() {
    return 'r' + this.published.length + '-' + (this.lastPublishAt || 0) + '-' + this.publishes;
  }

  /**
   * Related SKUs for AOV lift: same category first, then profitPotential.
   * Excludes self. Used by PDP SSR + GET /api/dropship/product/:id.
   */
  related(id, n) {
    const self = this.get(id);
    if (!self) return [];
    const limit = Math.max(1, Math.min(12, Number(n) || 4));
    const cat = self.category;
    return this.published
      .filter((p) => p && p.id !== id)
      .sort((a, b) => {
        const ac = a.category === cat ? 1 : 0;
        const bc = b.category === cat ? 1 : 0;
        if (bc !== ac) return bc - ac;
        return (b.profitPotential || 0) - (a.profitPotential || 0);
      })
      .slice(0, limit);
  }

  recordEvent(id, type, amountUsd) {
    const p = this.get(id);
    if (!p) return null;
    if (type === 'view') p.metrics.views += 1;
    else if (type === 'cart') p.metrics.carts += 1;
    else if (type === 'sale') { p.metrics.sales += 1; p.metrics.revenueUsd = round2(p.metrics.revenueUsd + (Number(amountUsd) || 0)); }
    else if (type === 'delivered') { p.metrics.delivered = (p.metrics.delivered || 0) + 1; p.lastDeliveredAt = now(); }
    return p;
  }

  list(opts) {
    const { sort = 'profit', category, limit = 60, search, includeHidden } = opts || {};
    let items = this.published.slice();
    // Autonomous Shelf Protocol: soft-hidden SKUs stay in memory but leave the
    // public storefront unless an operator explicitly asks for them.
    if (!includeHidden) items = items.filter((p) => !p.shelfHidden);
    if (category) items = items.filter(p => p.category === category);
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(p => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    if (sort === 'newest') items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    else if (sort === 'price-asc') items.sort((a, b) => a.priceUsd - b.priceUsd);
    else if (sort === 'price-desc') items.sort((a, b) => b.priceUsd - a.priceUsd);
    else if (sort === 'sales') items.sort((a, b) => (b.metrics.sales || 0) - (a.metrics.sales || 0));
    else if (sort === 'shelf') {
      items.sort((a, b) => {
        const ar = (a.shelf && a.shelf.rank) || 9999;
        const br = (b.shelf && b.shelf.rank) || 9999;
        if (ar !== br) return ar - br;
        return (b.shelf && b.shelf.fitness || 0) - (a.shelf && a.shelf.fitness || 0);
      });
    }
    else items.sort((a, b) => b.profitPotential - a.profitPotential); // default: profit
    return items.slice(0, Math.min(MAX_PUBLISHED, limit));
  }

  categories() {
    const set = new Set();
    for (const p of this.published) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }

  status() {
    return {
      ok: true,
      published: this.published.length,
      lifetime: this.publishes,
      lastPublishAt: this.lastPublishAt ? new Date(this.lastPublishAt).toISOString() : null,
      perTick: DAILY_TARGET,
      catalogFloor: MIN_CATALOG,
      cooldownHours: REPUBLISH_COOLDOWN_MS / 3_600_000,
      categories: this.categories(),
      top: this.list({ limit: 5 }).map(p => ({ id: p.id, title: p.title, price: p.priceUsd, profit: p.netProfitUsd, score: p.profitPotential })),
    };
  }

  toState() {
    return {
      published: this.published.slice(0, 100),
      publishedAt: Array.from(this.publishedAt.entries()).slice(-200),
      publishes: this.publishes, lastPublishAt: this.lastPublishAt,
    };
  }
  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.published)) {
      this.published = s.published.slice(0, MAX_PUBLISHED);
      this.byId.clear();
      for (const p of this.published) this.byId.set(p.id, p);
    }
    if (Array.isArray(s.publishedAt)) this.publishedAt = new Map(s.publishedAt);
    if (Number.isFinite(s.publishes)) this.publishes = s.publishes;
    if (Number.isFinite(s.lastPublishAt)) this.lastPublishAt = s.lastPublishAt;
  }
}

module.exports = { AutoPublisher };
