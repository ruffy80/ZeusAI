// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Zeus Autonomic Commerce Core · ORCHESTRATOR.
// RO: primul sistem economic complet autonom. Leagă cele 9 componente într-o
// singură buclă: scanează piața → sintetizează idei → construiește produse →
// stabilește prețuri → se auto-vindecă → încasează (BTC) → învață → evoluează.
//
// Rulează IN-PROCES în clusterul backend (la fel ca opportunityRadar /
// autonomousInnovation), pornit de require() din backend/index.js. Bucla
// folosește setInterval().unref() ca să nu țină procesul în viață artificial
// și să nu blocheze shutdown-ul. GOLDEN RULE #6: nu oprește niciodată procesul.

'use strict';

const { now, logger, OWNER_BTC } = require('./util');
const { MarketScanner } = require('./scanner');
const { IdeaSynthesizer } = require('./synthesizer');
const { AutoBuilder } = require('./builder');
const { PricingEngine } = require('./pricing');
const { SelfHealing } = require('./health');
const { RevenueAutopilot } = require('./revenue');
const { MultiInstanceManager } = require('./multi');
const { SelfLearningCore } = require('./learning');
const { EternalEvolution } = require('./evolution');
const { BtcPayments } = require('./payments');
const { GlobalScraper } = require('./scraper');
const { ProfitMaximizer } = require('./profit');
const { AutoPublisher } = require('./publisher');
const { FulfillmentRouter } = require('./fulfillment');
const { OrderStore } = require('./orders');
const { AutonomousShelfProtocol } = require('./shelf-protocol');
const shipping = require('./shipping');
const notify = require('./notify');
const store = require('./store');

const log = logger('core');

const TICK_INTERVAL_MS = Number(process.env.ZACC_TICK_MS || 60 * 60 * 1000); // hourly
const ENABLED = process.env.ZACC_ENABLED !== '0';
const AUTO_APPROVE = process.env.ZACC_AUTO_APPROVE !== '0';
const MAX_ACTIVE_PRODUCTS = Number(process.env.ZACC_MAX_PRODUCTS || 120);

class ZeusAutonomicCommerceCore {
  constructor() {
    this.version = '2.0.0';
    this.startedAt = now();
    this.enabled = ENABLED;
    this.ticks = 0;
    this.lastTickAt = null;
    this.lastError = null;
    this.timer = null;

    // External catalog sink (set by backend so ZACC products show in /services).
    this._serviceSink = null;
    // Throttled persistence bookkeeping.
    this._lastPersistAt = 0;
    this._persistMinIntervalMs = Number(process.env.ZACC_PERSIST_MS || 30 * 1000);

    // Shared context handed to every component (telemetry hook + learning params).
    const ctx = {
      telemetry: () => this._telemetry(),
      params: () => this.learning.params,
      onPaid: (invoice) => this._onPaid(invoice),
    };
    this.scanner = new MarketScanner(ctx);
    this.synthesizer = new IdeaSynthesizer(ctx);
    this.builder = new AutoBuilder(ctx);
    this.pricing = new PricingEngine(ctx);
    this.health = new SelfHealing(ctx);
    this.revenue = new RevenueAutopilot(ctx);
    this.multi = new MultiInstanceManager(ctx);
    this.learning = new SelfLearningCore(ctx);
    this.evolution = new EternalEvolution(ctx);
    this.payments = new BtcPayments(ctx);
    // Autonomous dropshipping pipeline (scrape → profit-filter → publish → fulfill).
    this.scraper = new GlobalScraper(ctx);
    this.profit = new ProfitMaximizer(ctx);
    this.publisher = new AutoPublisher(ctx);
    this.fulfillment = new FulfillmentRouter(ctx);
    // Order backbone: source-of-truth for buyer contact, shipping, invoice
    // linkage, margin and an auditable timeline (persists to data/zacc/orders.json).
    this.orders = new OrderStore(ctx);
    // ASP — Autonomous Shelf Protocol (novel public shelf tournament + ledger).
    this.shelf = new AutonomousShelfProtocol(ctx);
    this.shipping = shipping;

    // Register components with the watchdog (reinit = re-run their step).
    this.health.register('scanner', () => this.scanner.scan().catch(() => {}));
    this.health.register('synthesizer', () => {});
    this.health.register('builder', () => {});
    this.health.register('pricing', () => this.pricing.reprice(this.builder.products, true));
    this.health.register('revenue', () => {});
    this.health.register('learning', () => {});
    this.health.register('payments', () => this.payments.poll(true).catch(() => {}));
    this.health.register('scraper', () => this.scraper.scrape(true).catch(() => {}));
    this.health.register('publisher', () => {});
    this.health.register('fulfillment', () => {});

    // Restore durable state from disk so a deploy / reload never wipes the
    // economy (products, sales, learning, invoices survive). Fail-soft.
    try { this._restore(); } catch (e) { log.warn('restore skipped:', e.message); }

    if (this.enabled) this.start();
  }

  // Allow the backend to receive every built product (e.g. publish into the
  // main /services catalog). Backfills products built before the sink was set.
  setServiceSink(fn) {
    if (typeof fn !== 'function') return;
    this._serviceSink = fn;
    // Wire publisher to push dropship items into the main catalog as well.
    try { this.publisher.setSink(fn); } catch (_) { /* fail-soft */ }
    try { for (const p of this.builder.products) fn(p); }
    catch (e) { log.warn('service sink backfill:', e.message); }
    try { for (const p of this.publisher.published) fn(p); }
    catch (e) { log.warn('publisher sink backfill:', e.message); }
  }

  _publishProduct(product) {
    if (!product || !this._serviceSink) return;
    try { this._serviceSink(product); } catch (e) { log.warn('service sink:', e.message); }
  }

  // A confirmed BTC payment landed for an invoice → record the sale and mark
  // the product delivered. This is the real money-in path (vs. the demo hook).
  _onPaid(invoice) {
    if (!invoice || !invoice.productId) return;
    try {
      this.recordSale(invoice.productId, invoice.amountUsd);
      this.builder.recordEvent(invoice.productId, 'delivered');
      this.publisher.recordEvent(invoice.productId, 'sale', invoice.amountUsd);

      // Reconcile the order backbone: find the order via invoice id (fall back
      // to the token embedded on the invoice) and mark it paid.
      const order = this.orders.getByInvoiceId(invoice.id)
        || (invoice.orderToken ? this.orders.getByToken(invoice.orderToken) : null);
      if (order) this.orders.markPaid(order.token, { txid: invoice.txid || null });

      // If this is a dropship product, route to a real fulfillment provider
      // with the full buyer contact captured on the order/invoice.
      const dropship = this.publisher.get(invoice.productId);
      if (dropship) {
        const contact = {
          productId: invoice.productId,
          productTitle: dropship.title,
          amountUsd: invoice.amountUsd,
          invoiceId: invoice.id,
          orderToken: order ? order.token : (invoice.orderToken || null),
          email: (order && order.email) || invoice.email || null,
          shipping: (order && order.shipping) || invoice.shipping || null,
          qty: (order && order.qty) || invoice.qty || 1,
          supplierRef: dropship.supplierRef != null ? dropship.supplierRef : null,
          demoOnly: dropship.demoOnly === true,
        };
        this.fulfillment.onOrder(contact).then((routed) => {
          if (order && routed && routed.order) {
            this.orders.markRouted(order.token, { provider: routed.order.result && routed.order.result.provider, result: routed.order.result });
          }
        }).catch(e => log.warn('fulfillment route failed:', e.message));
      }

      // Best-effort owner alert that money landed.
      try {
        notify.orderPaid({
          orderToken: order ? order.token : (invoice.orderToken || null),
          productTitle: dropship ? dropship.title : invoice.productId,
          qty: (order && order.qty) || invoice.qty || 1,
          amountUsd: invoice.amountUsd,
          email: (order && order.email) || invoice.email || null,
        });
      } catch (_) { /* fail-soft */ }

      log.info('delivered', invoice.productId, 'for invoice', invoice.id, '($' + invoice.amountUsd + ')');
      this._persist(true);
    } catch (e) { log.warn('_onPaid failed:', e.message); }
  }

  // ---- Dropship order backbone (called by /api/dropship/order routes) ----
  // Creates an order (buyer contact + shipping quote), mints a BTC invoice with
  // the order linkage in meta, and links the two together. Returns everything
  // the checkout UI needs. Never throws unhandled — routes wrap in try/catch.
  async createDropshipOrder({ productId, email, shipping: ship, qty, addons }) {
    const product = this.publisher.get(productId);
    if (!product) return { ok: false, error: 'product_not_found' };
    // Commerce Reality OS — demo / world-feed SKUs must never take payment.
    if (product.demoOnly === true && process.env.ALLOW_DEMO_CHECKOUT !== '1') {
      return { ok: false, error: 'demo_not_for_sale', reason: 'demoOnly' };
    }
    if (product.dispatchable === false && process.env.ALLOW_DEMO_CHECKOUT !== '1') {
      return { ok: false, error: 'demo_not_for_sale', reason: 'not_dispatchable' };
    }
    const quantity = Math.max(1, Number(qty) || 1);

    // Optional AOV add-ons (max 3) — related margin-qualified SKUs.
    const addonIds = Array.isArray(addons) ? addons : [];
    const addonProducts = [];
    let addonUsd = 0;
    let addonMargin = 0;
    for (const rawId of addonIds.slice(0, 3)) {
      const ap = this.publisher.get(rawId);
      if (!ap || ap.id === product.id) continue;
      if (addonProducts.some((x) => x.id === ap.id)) continue;
      addonProducts.push(ap);
      addonUsd += Number(ap.priceUsd) || 0;
      addonMargin += Number(ap.netProfitUsd) || 0;
      try { this.publisher.recordEvent(ap.id, 'cart'); } catch (_) { /* fail-soft */ }
    }
    addonUsd = Math.round(addonUsd * 100) / 100;
    addonMargin = Math.round(addonMargin * 100) / 100;

    // 2) Shipping quote for the destination country. Pass the retail price as
    // the item cost so the returned quote.totalUsd is the buyer-facing total.
    const country = (ship && (ship.country || ship.countryCode)) || 'US';
    const quote = this.shipping.quote({
      country,
      costUsd: product.priceUsd,
      shippingUsdBase: product.shippingUsd,
      qty: quantity,
      weightKg: product.weightKg,
    });
    const itemUsd = Math.round(product.priceUsd * quantity * 100) / 100;
    const amountUsd = Math.round((itemUsd + quote.shippingUsd + addonUsd) * 100) / 100;
    const marginUsd = Math.round((((product.netProfitUsd || 0) * quantity) + addonMargin) * 100) / 100;

    // 3) Create the order record.
    const order = this.orders.create({
      productId: product.id,
      productTitle: product.title,
      email,
      shipping: ship || null,
      qty: quantity,
      amountUsd,
      shippingUsd: quote.shippingUsd,
      marginUsd,
      addonUsd,
      addons: addonProducts.map((a) => ({ id: a.id, title: a.title, priceUsd: a.priceUsd })),
      demoOnly: product.demoOnly === true,
    });

    // 4) Mint the BTC invoice with order linkage in meta.
    const invoice = await this.payments.createInvoice(product.id, amountUsd, {
      email,
      shipping: ship || null,
      qty: quantity,
      orderToken: order.token,
      shippingUsd: quote.shippingUsd,
      addonUsd,
      addons: addonProducts.map((a) => a.id),
    });

    // 5) Link invoice → order (moves order to awaiting_payment).
    this.orders.linkInvoice(order.token, invoice.id);

    this._persist(true);
    return {
      ok: true,
      orderToken: order.token,
      invoice,
      quote: Object.assign({}, quote, { itemUsd, addonUsd, totalUsd: amountUsd }),
      addons: addonProducts.map((a) => ({ id: a.id, title: a.title, priceUsd: a.priceUsd })),
      product: { id: product.id, title: product.title, priceUsd: product.priceUsd, image: product.image, demoOnly: product.demoOnly === true },
    };
  }

  // Best-effort live economy pulse. Kept local + cheap; the scanner blends it
  // with its source taxonomy. A richer telemetry hook can be injected later.
  _telemetry() {
    return { economyPulse: 50 + (this.ticks % 30) };
  }

  // After restore, stale seed listings (pre–Dropship OS) may lack proofOfMargin
  // / zeus-curated metadata. Rebuild from the curated catalogue so the live
  // storefront always looks world-class even with zero supplier API keys.
  async ensureWorldCatalog() {
    try {
      const purged = (typeof this.publisher.purgeJunk === 'function')
        ? this.publisher.purgeJunk()
        : { removed: 0, remaining: (this.publisher.published || []).length };
      this._junkPurgedTotal = (this._junkPurgedTotal || 0) + (purged.removed || 0);

      const live = this.publisher.published || [];
      const modern = live.filter((p) => p && p.proofOfMargin && (p.source === 'zeus-curated' || p.demoOnly === true || String(p.source || '').includes('world'))).length;
      const withImages = live.filter((p) => p && p.image && !/picsum\.photos|placeimg|placehold/i.test(String(p.image))).length;
      const worldish = live.filter((p) => p && /world|dummyjson|fakestore|ebay|etsy|aliexpress/i.test(String(p.source || ''))).length;
      const hasDummy = live.some((p) => p && p.source === 'dummyjson-world');
      const hasHttpsImg = live.some((p) => p && /^https?:\/\//i.test(String(p.image || '')));
      const escuelaJunk = live.some((p) => p && p.source === 'escuela-world');
      // Rebuild when catalogue is thin, junk was purged, images are broken, or
      // we lack a multi-source worldwide intake (autonomy requires global SKUs).
      if (
        purged.removed === 0 && !escuelaJunk
        && modern >= 12 && live.length >= 24 && withImages >= 18 && worldish >= 10 && hasDummy && hasHttpsImg
      ) {
        return { rebuilt: false, modern, live: live.length, withImages, worldish, hasDummy, junkPurged: purged.removed };
      }
      log.info('ensureWorldCatalog · rebuilding storefront from world feeds + curated (modern=' + modern + ', live=' + live.length + ', imgs=' + withImages + ', world=' + worldish + ', junkPurged=' + purged.removed + ')');
      this.publisher.published = [];
      if (this.publisher.byId && typeof this.publisher.byId.clear === 'function') this.publisher.byId.clear();
      if (this.publisher.publishedAt && typeof this.publisher.publishedAt.clear === 'function') this.publisher.publishedAt.clear();
      this.scraper.products = [];
      await this.scraper.scrape(true);
      const qualified = this.profit.rank(this.scraper.recent(500));
      const published = this.publisher.publish(qualified, Math.max(48, Number(process.env.ZACC_BOOT_PUBLISH || 48)));
      if (typeof this.publisher.purgeJunk === 'function') this.publisher.purgeJunk();
      try { this.shelf.runTournament(this.publisher); } catch (_) { /* fail-soft */ }
      this._persist(true);
      return { rebuilt: true, modern: published.length, live: this.publisher.published.length, junkPurged: purged.removed };
    } catch (e) {
      log.warn('ensureWorldCatalog failed:', e.message);
      return { rebuilt: false, error: e.message };
    }
  }

  start() {
    if (this.timer) return;
    // Rebuild curated storefront ASAP, then run a full boot tick.
    setTimeout(() => {
      this.ensureWorldCatalog()
        .then((r) => {
          log.info('ensureWorldCatalog', JSON.stringify(r));
          if (typeof this.publisher.purgeJunk === 'function') {
            const p = this.publisher.purgeJunk();
            this._junkPurgedTotal = (this._junkPurgedTotal || 0) + (p.removed || 0);
            if (p.removed) this._persist(true);
          }
        })
        .catch((e) => log.warn('ensureWorldCatalog', e.message))
        .finally(() => this.tick('boot').catch((e) => log.warn('boot tick', e.message)));
    }, 2500);
    this.timer = setInterval(() => {
      this.tick('interval').catch(e => log.warn('interval tick', e.message));
    }, TICK_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    log.info('ZACC started · autonomous loop every', Math.round(TICK_INTERVAL_MS / 60000), 'min · BTC payout', OWNER_BTC);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    log.info('ZACC stopped');
  }

  // One full autonomous cycle. Each stage is guarded so one failure self-heals
  // without aborting the rest of the loop.
  async tick(trigger) {
    const t0 = Date.now();
    const summary = { trigger: trigger || 'manual', at: now(), stages: {} };

    // 1) SCAN
    let trends = [];
    try {
      trends = await this.scanner.scan();
      this.health.heartbeat('scanner');
      summary.stages.scan = { trends: trends.length };
    } catch (e) { this.health.reportFailure('scanner', e); summary.stages.scan = { error: e.message }; }

    // 2) SYNTHESIZE
    let ideas = [];
    try {
      ideas = this.synthesizer.synthesize(trends);
      this.health.heartbeat('synthesizer');
      summary.stages.synthesize = { ideas: ideas.length };
    } catch (e) { this.health.reportFailure('synthesizer', e); summary.stages.synthesize = { error: e.message }; }

    // 3) AUTO-APPROVE + BUILD (respect product cap)
    let built = 0;
    try {
      if (this.builder.products.length < MAX_ACTIVE_PRODUCTS) {
        for (const idea of ideas) {
          if (AUTO_APPROVE) idea.status = 'approved';
          if (idea.status !== 'approved') continue;
          const niche = this.multi.routeIdea(idea);
          const product = this.builder.build(idea, { niche });
          if (product) {
            idea.status = 'active';
            this.multi.countProduct(niche);
            this.learning.record('product', product.title + ' ' + product.description, { id: product.id, priceUsd: product.priceUsd });
            this._publishProduct(product);
            built += 1;
          }
        }
      }
      this.health.heartbeat('builder');
      summary.stages.build = { built, activeProducts: this.builder.products.length };
    } catch (e) { this.health.reportFailure('builder', e); summary.stages.build = { error: e.message }; }

    // 4) REPRICE (throttled internally to 6x/day)
    try {
      const decisions = this.pricing.reprice(this.builder.products);
      this.health.heartbeat('pricing');
      summary.stages.reprice = { adjusted: decisions.length };
    } catch (e) { this.health.reportFailure('pricing', e); summary.stages.reprice = { error: e.message }; }

    // 5) SELF-HEAL sweep
    try {
      const recovered = this.health.sweep();
      summary.stages.health = { recovered: recovered.length };
    } catch (e) { summary.stages.health = { error: e.message }; }

    // 6) REVENUE daily report (due check internal)
    try {
      const rep = await this.revenue.sendDailyReport();
      this.health.heartbeat('revenue');
      summary.stages.revenue = { reportSent: !!rep.sent };
    } catch (e) { this.health.reportFailure('revenue', e); summary.stages.revenue = { error: e.message }; }

    // 7) LEARN (weekly analysis, due check internal) + sync params downstream
    try {
      const analysis = this.learning.analyze();
      this.health.heartbeat('learning');
      summary.stages.learn = { analyzed: !!analysis };
    } catch (e) { this.health.reportFailure('learning', e); summary.stages.learn = { error: e.message }; }

    // 8) EVOLVE (monthly, due check internal)
    try {
      const evo = this.evolution.scan();
      summary.stages.evolve = { proposals: evo.length };
    } catch (e) { summary.stages.evolve = { error: e.message }; }

    // 9) PAYMENTS — confirm BTC invoices on-chain (throttled; only polls when
    // invoices are open). Confirmed payments auto-deliver via _onPaid().
    try {
      const pay = await this.payments.poll();
      this.health.heartbeat('payments');
      summary.stages.payments = { polled: !!pay.polled, matched: (pay.matched && pay.matched.length) || 0 };
    } catch (e) { this.health.reportFailure('payments', e); summary.stages.payments = { error: e.message }; }

    // 10) DROPSHIPPING — global scrape (auto-throttled to every 6h internally).
    let scraped = [];
    try {
      const r = await this.scraper.scrape();
      scraped = this.scraper.recent(300);
      this.health.heartbeat('scraper');
      summary.stages.scrape = r;
    } catch (e) { this.health.reportFailure('scraper', e); summary.stages.scrape = { error: e.message }; }

    // 11) PROFIT — filter scraped products and rank by profit potential.
    let qualified = [];
    try {
      qualified = this.profit.rank(scraped);
      summary.stages.profit = { qualified: qualified.length, top: qualified[0] ? qualified[0].profitPotential : 0 };
    } catch (e) { summary.stages.profit = { error: e.message }; }

    // 12) PUBLISH — auto-publish top scored products into /dropship + /services.
    try {
      const added = this.publisher.publish(qualified, undefined);
      summary.stages.publish = { added: added.length, total: this.publisher.published.length };
    } catch (e) { summary.stages.publish = { error: e.message }; }

    // 12b) CJ TRACKING POLL — honest buyer status. Only runs when a CJ key is
    // armed AND there is at least one CJ-routed order to poll. Fail-honest.
    try {
      const pollRes = await this.fulfillment.pollCjTracking(this.orders);
      if (pollRes && pollRes.polled) summary.stages.trackingPoll = pollRes;
    } catch (e) { summary.stages.trackingPoll = { error: e.message }; }

    // 13) SHELF TOURNAMENT — Autonomous Shelf Protocol (invented differentiator).
    // SKUs compete for rank by living fitness; decisions land in the public ledger.
    try {
      const shelfRes = this.shelf.runTournament(this.publisher);
      summary.stages.shelf = {
        ok: !!(shelfRes && shelfRes.ok),
        tournaments: this.shelf.tournaments,
        visible: shelfRes && shelfRes.tournament && shelfRes.tournament.visible,
        ledgerHash: shelfRes && shelfRes.ledgerHash,
      };
    } catch (e) { summary.stages.shelf = { error: e.message }; }

    this.ticks += 1;
    this.lastTickAt = now();
    summary.durationMs = Date.now() - t0;
    this._lastSummary = summary;
    // Persist durable state after every cycle (throttled, fail-soft).
    this._persist();
    return summary;
  }

  // ---- Public commerce hooks (called by backend routes) ----------------
  recordView(productId) {
    this.builder.recordEvent(productId, 'view');
    this.learning.record('view', productId, { productId });
  }
  recordCart(productId) { this.builder.recordEvent(productId, 'cart'); }
  recordSale(productId, amountUsd) {
    const p = this.builder.getProduct(productId);
    this.builder.recordEvent(productId, 'sale');
    const sale = this.revenue.recordSale(productId, amountUsd, { title: p && p.title });
    if (p) { p.metrics.revenueUsd += Number(amountUsd) || 0; this.multi.attribute(p.niche, amountUsd); }
    this.learning.record('sale', (p && p.title) || productId, { productId, amountUsd: Number(amountUsd) || 0 }, 'won');
    return sale;
  }
  offerFor(productId, visitor) {
    const p = this.builder.getProduct(productId);
    if (!p) return null;
    return this.pricing.offerFor(p, visitor);
  }
  approveIdea(ideaId) {
    const idea = this.synthesizer.setStatus(ideaId, 'approved');
    if (!idea) return null;
    const niche = this.multi.routeIdea(idea);
    const product = this.builder.build(idea, { niche });
    if (product) { idea.status = 'active'; this.multi.countProduct(niche); this._publishProduct(product); this._persist(true); }
    return { idea, product };
  }

  // Create a real BTC invoice for a product (unique amount → on-chain match).
  async createInvoice(productId) {
    const p = this.builder.getProduct(productId);
    if (!p) return null;
    const inv = await this.payments.createInvoice(productId, p.priceUsd);
    this._persist(true);
    return { invoice: inv, product: { id: p.id, title: p.title, priceUsd: p.priceUsd } };
  }

  // ---- Durable persistence -------------------------------------------
  serialize() {
    return {
      startedAt: this.startedAt,
      ticks: this.ticks,
      lastTickAt: this.lastTickAt,
      scanner: { trends: this.scanner.trends.slice(0, 60), scanCount: this.scanner.scanCount },
      synthesizer: { ideas: this.synthesizer.ideas.slice(0, 100), generated: this.synthesizer.generated },
      builder: { products: this.builder.products.slice(0, 200), built: this.builder.built },
      pricing: { history: this.pricing.history.slice(0, 50), repriceCount: this.pricing.repriceCount, lastRepriceAt: this.pricing.lastRepriceAt },
      revenue: { sales: this.revenue.sales.slice(0, 500), totalUsd: this.revenue.totalUsd, lastReportAt: this.revenue.lastReportAt, reportsSent: this.revenue.reportsSent },
      multi: this.multi.toState(),
      learning: { params: this.learning.params, vectors: this.learning.vectors.slice(0, 500) },
      evolution: { proposals: this.evolution.proposals.slice(0, 40), scans: this.evolution.scans, lastScanAt: this.evolution.lastScanAt },
      payments: this.payments.toState(),
      scraper: this.scraper.toState(),
      profit: this.profit.toState(),
      publisher: this.publisher.toState(),
      fulfillment: this.fulfillment.toState(),
      orders: this.orders.toState(),
      shelf: this.shelf.toState(),
    };
  }

  _restore() {
    const s = store.load();
    if (!s) return false;
    if (s.startedAt) this.startedAt = s.startedAt;
    if (Number.isFinite(s.ticks)) this.ticks = s.ticks;
    if (s.lastTickAt) this.lastTickAt = s.lastTickAt;
    if (s.scanner) { if (Array.isArray(s.scanner.trends)) this.scanner.trends = s.scanner.trends; if (Number.isFinite(s.scanner.scanCount)) this.scanner.scanCount = s.scanner.scanCount; }
    if (s.synthesizer) { if (Array.isArray(s.synthesizer.ideas)) this.synthesizer.ideas = s.synthesizer.ideas; if (Number.isFinite(s.synthesizer.generated)) this.synthesizer.generated = s.synthesizer.generated; }
    if (s.builder) { if (Array.isArray(s.builder.products)) this.builder.products = s.builder.products; if (Number.isFinite(s.builder.built)) this.builder.built = s.builder.built; }
    if (s.pricing) { if (Array.isArray(s.pricing.history)) this.pricing.history = s.pricing.history; if (Number.isFinite(s.pricing.repriceCount)) this.pricing.repriceCount = s.pricing.repriceCount; if (Number.isFinite(s.pricing.lastRepriceAt)) this.pricing.lastRepriceAt = s.pricing.lastRepriceAt; }
    if (s.revenue) { if (Array.isArray(s.revenue.sales)) this.revenue.sales = s.revenue.sales; if (Number.isFinite(s.revenue.totalUsd)) this.revenue.totalUsd = s.revenue.totalUsd; if (Number.isFinite(s.revenue.lastReportAt)) this.revenue.lastReportAt = s.revenue.lastReportAt; if (Number.isFinite(s.revenue.reportsSent)) this.revenue.reportsSent = s.revenue.reportsSent; }
    if (s.multi) this.multi.fromState(s.multi);
    if (s.learning) { if (s.learning.params) this.learning.params = Object.assign(this.learning.params, s.learning.params); if (Array.isArray(s.learning.vectors)) this.learning.vectors = s.learning.vectors; }
    if (s.evolution) { if (Array.isArray(s.evolution.proposals)) this.evolution.proposals = s.evolution.proposals; if (Number.isFinite(s.evolution.scans)) this.evolution.scans = s.evolution.scans; if (Number.isFinite(s.evolution.lastScanAt)) this.evolution.lastScanAt = s.evolution.lastScanAt; }
    if (s.payments) this.payments.fromState(s.payments);
    if (s.scraper) this.scraper.fromState(s.scraper);
    if (s.profit) this.profit.fromState(s.profit);
    if (s.publisher) this.publisher.fromState(s.publisher);
    if (s.fulfillment) this.fulfillment.fromState(s.fulfillment);
    // Orders persist to their own file (data/zacc/orders.json); restore them
    // from there, falling back to any snapshot embedded in the main state.
    if (!this.orders.restore() && s.orders) this.orders.fromState(s.orders);
    if (s.shelf) this.shelf.fromState(s.shelf);
    // Re-rank shelf after restore so fitness reflects current metrics / env.
    try {
      if (this.publisher.published.length) this.shelf.runTournament(this.publisher);
    } catch (_) { /* fail-soft */ }
    log.info('state restored · products', this.builder.products.length, '· dropship', this.publisher.published.length, '· orders', this.orders.orders.length, '· lifetime $' + this.revenue.totalUsd);
    return true;
  }

  _persist(force) {
    if (!force && Date.now() - this._lastPersistAt < this._persistMinIntervalMs) return false;
    this._lastPersistAt = Date.now();
    return store.save(this.serialize());
  }

  // ---- Snapshots for the API + site page -------------------------------
  status() {
    return {
      ok: true,
      brand: 'Zeus Autonomic Commerce Core',
      acronym: 'ZACC',
      version: this.version,
      enabled: this.enabled,
      autonomous: true,
      autoApprove: AUTO_APPROVE,
      startedAt: this.startedAt,
      ticks: this.ticks,
      lastTickAt: this.lastTickAt,
      tickIntervalMin: Math.round(TICK_INTERVAL_MS / 60000),
      payout: { method: 'BTC', btcAddress: OWNER_BTC },
      components: {
        scanner: this.scanner.status(),
        synthesizer: this.synthesizer.status(),
        builder: this.builder.status(),
        pricing: this.pricing.status(),
        health: this.health.status(),
        revenue: this.revenue.status(),
        multi: this.multi.status(),
        learning: this.learning.status(),
        evolution: this.evolution.status(),
        payments: this.payments.status(),
        scraper: this.scraper.status(),
        profit: this.profit.status(),
        publisher: this.publisher.status(),
        fulfillment: this.fulfillment.status(),
        orders: this.orders.status(),
        shelf: this.shelf.status(),
      },
      shipping: { zones: Object.keys(this.shipping.ZONES) },
      lastCycle: this._lastSummary || null,
      catalogQuality: {
        junkPurged: this._junkPurgedTotal || 0,
        qualityGate: true,
        live: this.publisher.published.length,
      },
    };
  }

  // Compact snapshot for the public site page (no internal-only fields).
  publicSnapshot() {
    return {
      ok: true,
      brand: 'Zeus Autonomic Commerce Core',
      autonomous: true,
      startedAt: this.startedAt,
      ticks: this.ticks,
      lastTickAt: this.lastTickAt,
      payout: { method: 'BTC', btcAddress: OWNER_BTC },
      catalogQuality: {
        junkPurged: this._junkPurgedTotal || 0,
        qualityGate: true,
      },
      counts: {
        sources: this.scanner.sourceCount(),
        trends: this.scanner.trends.length,
        ideas: this.synthesizer.ideas.length,
        products: this.builder.products.length,
        niches: this.multi.status().active,
        scraped: this.scraper.products.length,
        qualified: this.profit.scored.length,
        dropshipPublished: this.publisher.published.length,
        ordersRouted: this.fulfillment.routed,
        ordersPending: this.fulfillment.pendingOrders.length,
        orders: this.orders.orders.length,
        ordersPaid: this.orders.status().counts.paid,
        ordersShipped: this.orders.status().counts.shipped,
      },
      revenue: { lifetimeUsd: this.revenue.totalUsd, last24hUsd: this.revenue.status().last24hUsd },
      payments: { openInvoices: this.payments.status().openInvoices, paidInvoices: this.payments.status().paidInvoices, onChain: true },
      persisted: true,
      trends: this.scanner.top(6),
      ideas: this.synthesizer.ideas.slice(0, 6).map(i => ({ name: i.name, type: i.type, priceUsd: i.priceUsd, marginPct: i.marginPct, status: i.status })),
      products: this.builder.publicList(12),
      dropship: this.publisher.list({ sort: 'shelf', limit: 12 }),
      dropshipCategories: this.publisher.categories(),
      shelf: {
        protocol: 'zeus-asp-v1',
        tournaments: this.shelf.tournaments,
        seals: this.shelf.seals,
        lastTournament: this.shelf.lastTournament,
        ledgerHead: (this.shelf.entries[0] && {
          hash: this.shelf.entries[0].hash,
          seq: this.shelf.entries[0].seq,
          type: this.shelf.entries[0].type,
          at: this.shelf.entries[0].at,
        }) || null,
      },
      evolution: this.evolution.proposals.slice(0, 4),
      generatedAt: now(),
    };
  }
}

// Singleton (matches the rest of the module ecosystem).
module.exports = new ZeusAutonomicCommerceCore();
