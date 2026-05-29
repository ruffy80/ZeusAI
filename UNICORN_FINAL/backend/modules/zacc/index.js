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

const log = logger('core');

const TICK_INTERVAL_MS = Number(process.env.ZACC_TICK_MS || 60 * 60 * 1000); // hourly
const ENABLED = process.env.ZACC_ENABLED !== '0';
const AUTO_APPROVE = process.env.ZACC_AUTO_APPROVE !== '0';
const MAX_ACTIVE_PRODUCTS = Number(process.env.ZACC_MAX_PRODUCTS || 120);

class ZeusAutonomicCommerceCore {
  constructor() {
    this.version = '1.0.0';
    this.startedAt = now();
    this.enabled = ENABLED;
    this.ticks = 0;
    this.lastTickAt = null;
    this.lastError = null;
    this.timer = null;

    // Shared context handed to every component (telemetry hook + learning params).
    const ctx = {
      telemetry: () => this._telemetry(),
      params: () => this.learning.params,
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

    // Register components with the watchdog (reinit = re-run their step).
    this.health.register('scanner', () => this.scanner.scan().catch(() => {}));
    this.health.register('synthesizer', () => {});
    this.health.register('builder', () => {});
    this.health.register('pricing', () => this.pricing.reprice(this.builder.products, true));
    this.health.register('revenue', () => {});
    this.health.register('learning', () => {});

    if (this.enabled) this.start();
  }

  // Best-effort live economy pulse. Kept local + cheap; the scanner blends it
  // with its source taxonomy. A richer telemetry hook can be injected later.
  _telemetry() {
    return { economyPulse: 50 + (this.ticks % 30) };
  }

  start() {
    if (this.timer) return;
    // Kick an initial tick shortly after boot so the page has data fast.
    setTimeout(() => this.tick('boot').catch(e => log.warn('boot tick', e.message)), 4000);
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

    this.ticks += 1;
    this.lastTickAt = now();
    summary.durationMs = Date.now() - t0;
    this._lastSummary = summary;
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
    if (product) { idea.status = 'active'; this.multi.countProduct(niche); }
    return { idea, product };
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
      },
      lastCycle: this._lastSummary || null,
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
      counts: {
        sources: this.scanner.sourceCount(),
        trends: this.scanner.trends.length,
        ideas: this.synthesizer.ideas.length,
        products: this.builder.products.length,
        niches: this.multi.status().active,
      },
      revenue: { lifetimeUsd: this.revenue.totalUsd, last24hUsd: this.revenue.status().last24hUsd },
      trends: this.scanner.top(6),
      ideas: this.synthesizer.ideas.slice(0, 6).map(i => ({ name: i.name, type: i.type, priceUsd: i.priceUsd, marginPct: i.marginPct, status: i.status })),
      products: this.builder.publicList(12),
      evolution: this.evolution.proposals.slice(0, 4),
      generatedAt: now(),
    };
  }
}

// Singleton (matches the rest of the module ecosystem).
module.exports = new ZeusAutonomicCommerceCore();
