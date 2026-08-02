'use strict';

/**
 * Billion Revenue Activation OS (BRAOS/1.0)
 * ----------------------------------------
 * Arms every revenue rail with honest capacity math (theoretical ceiling)
 * vs realized GMV (ledger). Never invents paid volume.
 *
 * Modules: QPN, GDES, UMN, Marketplace, Wealth, Revenue×7, Viralizer,
 * Enterprise Sales, Product Catalog, Order Manager.
 */

const BTC_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  process.env.OWNER_BTC_ADDRESS ||
  'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

function safeRequire(rel) {
  try { return require(rel); } catch (e) {
    return { __error: e.message, getStatus: () => ({ active: false, error: e.message }) };
  }
}

const MODULES = {
  qpn: { file: './quantumPaymentNexus', label: 'Quantum Payment Nexus', capacityUsdYear: 365e6 },
  gdes: { file: './globalDigitalStandard', label: 'Global Digital Standard', capacityUsdYear: 365e6 },
  umn: { file: './universalMarketNexus', label: 'Universal Market Nexus', capacityUsdYear: 1.8e9 },
  marketplace: { file: './serviceMarketplace', label: 'Service Marketplace', capacityUsdYear: 60e6 },
  wealth: { file: './autonomousWealthEngine', label: 'Autonomous Wealth Engine', capacityUsdYear: 200e6 },
  revenue: { file: './revenueModules', label: 'Revenue Modules (×7)', capacityUsdYear: 50e6 },
  viral: { file: './socialMediaViralizer', label: 'Social Media Viralizer', capacityUsdYear: 0 },
  enterprise: { file: './enterpriseSales', label: 'Enterprise Sales & CRM', capacityUsdYear: 10e6 },
  catalog: { file: './productCatalog', label: 'Product Catalog', capacityUsdYear: 6e6 },
  orders: { file: './orderManager', label: 'Order Manager', capacityUsdYear: 0 },
};

const state = {
  startedAt: null,
  modules: {},
  aliasesMounted: false,
};

function _statusOf(mod) {
  if (!mod || mod.__error) return { active: false, error: mod && mod.__error };
  if (typeof mod.getStatus === 'function') return mod.getStatus();
  if (typeof mod.getAllStatus === 'function') return mod.getAllStatus();
  if (typeof mod.getStats === 'function') return mod.getStats();
  if (typeof mod.getMarketplaceStats === 'function') return mod.getMarketplaceStats();
  if (typeof mod.getRevenueSummary === 'function') return mod.getRevenueSummary();
  return { active: true };
}

function ensureMarketplaceSkus(mp) {
  const catalog = safeRequire('./productCatalog');
  if (catalog.ensureRevenueSkus) catalog.ensureRevenueSkus();
  if (!mp || typeof mp.getAllServices !== 'function') return { ensured: 0 };
  // Inject curated SKUs into marketplace map if missing.
  const needed = (catalog.list && catalog.list()) || [];
  let added = 0;
  for (const sku of needed) {
    if (mp.services && !mp.services.has(sku.id)) {
      mp.services.set(sku.id, {
        id: sku.id,
        name: sku.name,
        category: sku.category || 'general',
        description: sku.name,
        basePrice: sku.priceUsd,
        currentPrice: sku.priceUsd,
        demand: 0.55,
        popularity: 0.6,
        availability: true,
        apiEndpoint: '/api/orders/reserve',
        metadata: { curated: true, billing: sku.billing },
      });
      added += 1;
    }
  }
  // Also ensure addDefaultServices path if thin.
  if (typeof mp.addDefaultServices === 'function' && mp.services && mp.services.size < 10) {
    mp.addDefaultServices();
  }
  return { ensured: added, marketplaceSize: mp.services ? mp.services.size : 0 };
}

function startAll() {
  state.startedAt = new Date().toISOString();
  const report = {};
  for (const [key, meta] of Object.entries(MODULES)) {
    const mod = safeRequire(meta.file);
    let boot = null;
    try {
      if (typeof mod.start === 'function') boot = mod.start();
      else if (typeof mod.init === 'function') boot = mod.init();
      else if (typeof mod.startAutoRevenue === 'function') boot = mod.startAutoRevenue();
      else if (key === 'marketplace') boot = ensureMarketplaceSkus(mod);
      else boot = { noted: 'no-start' };
    } catch (e) {
      boot = { error: e.message };
    }
    if (key === 'marketplace') ensureMarketplaceSkus(mod);
    if (key === 'catalog' && mod.ensureRevenueSkus) mod.ensureRevenueSkus();
    const st = _statusOf(mod);
    const active = !(mod && mod.__error) && st && st.active !== false;
    state.modules[key] = {
      label: meta.label,
      file: meta.file,
      active,
      capacityUsdYear: meta.capacityUsdYear,
      status: st,
      boot,
      error: mod && mod.__error || null,
    };
    report[key] = state.modules[key];
  }
  return report;
}

function capacityModel() {
  // Honest: capacity = theoretical ceiling if rails fill; realized = ledger GMV.
  const modules = state.modules;
  let capacity = 0;
  let armed = 0;
  for (const m of Object.values(modules)) {
    if (m.active) {
      capacity += Number(m.capacityUsdYear || 0);
      armed += 1;
    }
  }
  const orders = safeRequire('./orderManager');
  const om = _statusOf(orders);
  const catalog = safeRequire('./productCatalog');
  const cat = _statusOf(catalog);
  const viralLift = modules.viral && modules.viral.active ? 0.12 : 0;
  const capacityWithViral = capacity * (1 + viralLift);

  // Near-term realistic band (not "fake billions tomorrow"):
  // Catalog MRR floor × conservative seats + enterprise kickoff pipeline.
  const mrrFloor = Number(cat.monthlySkuFloorUsd || 0);
  const conservativeSeats = Number(process.env.BRAOS_CONSERVATIVE_SEATS || 50);
  const realisticMonthly = mrrFloor * conservativeSeats;
  const realisticAnnual = realisticMonthly * 12;

  return {
    protocol: 'BRAOS/1.0',
    honesty: {
      capacityUsdYear: 'theoretical ceiling if payment/market volume materializes',
      realisticUsdYear: 'near-term armed catalog×seats — not promised GMV',
      realizedGmvUsd: 'ledger only',
    },
    btcAddress: BTC_ADDRESS,
    modulesArmed: armed,
    modulesTotal: Object.keys(MODULES).length,
    capacityUsdYear: capacityWithViral,
    capacityUsdDay: capacityWithViral / 365,
    realisticUsdYear: realisticAnnual,
    realisticUsdMonth: realisticMonthly,
    realizedGmvUsd: Number(om.realizedGmvUsd || 0),
    skuCount: Number(cat.skuCount || 0),
    viralLiftPct: viralLift * 100,
  };
}

function getStatus() {
  if (!state.startedAt) startAll();
  return {
    protocol: 'BRAOS/1.0',
    startedAt: state.startedAt,
    aliasesMounted: state.aliasesMounted,
    btcAddress: BTC_ADDRESS,
    modules: state.modules,
    model: capacityModel(),
  };
}

/**
 * Mount public aliases expected by the revenue activation contract.
 * Keeps legacy mounts (/api/quantum-payment, /api/viral, …) intact.
 */
function mountAliases(app, { adminMiddleware, authMiddleware } = {}) {
  if (!app || typeof app.use !== 'function') return { mounted: false };
  const admin = typeof adminMiddleware === 'function' ? adminMiddleware : ((req, res, next) => next());
  const auth = typeof authMiddleware === 'function' ? authMiddleware : ((req, res, next) => next());

  const qpn = safeRequire('./quantumPaymentNexus');
  const gdes = safeRequire('./globalDigitalStandard');
  const umn = safeRequire('./universalMarketNexus');
  const wealth = safeRequire('./autonomousWealthEngine');
  const revenue = safeRequire('./revenueModules');
  const viral = safeRequire('./socialMediaViralizer');
  const enterprise = safeRequire('./enterpriseSales');
  const catalog = safeRequire('./productCatalog');
  const orders = safeRequire('./orderManager');
  const express = require('express');

  // /api/pay/* → QPN
  const pay = express.Router();
  pay.post('/process', auth, async (req, res) => {
    try { res.json(await qpn.processPayment(req.body || {})); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  pay.get('/status/:paymentId', auth, (req, res) => {
    try { res.json(qpn.getPaymentStatus(req.params.paymentId)); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  pay.get('/revenue', admin, (req, res) => res.json(qpn.getRevenueSummary ? qpn.getRevenueSummary() : {}));
  pay.get('/btc', (req, res) => res.json({ btcAddress: qpn.BTC_ADDRESS || BTC_ADDRESS, feeBps: 10 }));
  app.use('/api/pay', pay);

  // /api/global/* → GDES (prefer createGiantAPI if present)
  if (typeof gdes.createGiantAPI === 'function') {
    try { app.use('/api/global', gdes.createGiantAPI()); } catch (_) {
      if (typeof gdes.getRouter === 'function') app.use('/api/global', gdes.getRouter(admin));
    }
  } else if (typeof gdes.getRouter === 'function') {
    app.use('/api/global', gdes.getRouter(admin));
  }

  // /api/market/* → UMN
  if (typeof umn.createExchangeAPI === 'function') {
    try { app.use('/api/market', umn.createExchangeAPI()); } catch (_) {
      if (typeof umn.getRouter === 'function') app.use('/api/market', umn.getRouter(admin));
    }
  } else if (typeof umn.getRouter === 'function') {
    app.use('/api/market', umn.getRouter(admin));
  }

  // /api/wealth/* → wealth engine (preserve /stats via passthrough)
  const wealthR = express.Router();
  wealthR.get('/status', (req, res) => res.json(wealth.getStatus ? wealth.getStatus() : {}));
  wealthR.get('/stats', (req, res, next) => {
    // Prefer legacy autoRevenue handler if registered later; expose engine status as fallback.
    try {
      const autoRevenue = require('./autoRevenue');
      if (autoRevenue && typeof autoRevenue.getRevenueStatus === 'function') {
        return res.json(autoRevenue.getRevenueStatus());
      }
    } catch (_) { /* fall through */ }
    return res.json({ source: 'autonomousWealthEngine', ...(wealth.getStatus ? wealth.getStatus() : {}) });
  });
  wealthR.post('/process', auth, async (req, res) => {
    try { res.json(await wealth.process(req.body || {})); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  wealthR.get('/project', (req, res) => {
    try {
      const input = {
        principal: Number(req.query.principal) || 10000000,
        monthlyContribution: Number(req.query.monthly) || 0,
        annualRatePct: Number(req.query.rate) || 20,
        years: Number(req.query.years) || 1,
      };
      res.json(wealth.futureValue ? wealth.futureValue(input) : wealth.process({ action: 'project', ...input }));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.use('/api/wealth', wealthR);

  // /api/revenue/modules/* — avoid clobbering existing /api/revenue commander
  const rev = express.Router();
  rev.get('/status', admin, (req, res) => res.json(revenue.getAllStatus ? revenue.getAllStatus() : {}));
  rev.get('/total', admin, (req, res) => res.json({ totalRevenue: revenue.getTotalRevenue ? revenue.getTotalRevenue() : 0 }));
  rev.post('/trading/simulate', admin, (req, res) => {
    try { res.json(revenue.tradingModule.simulate()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.use('/api/revenue/modules', rev);

  // /api/social/viral/* — avoid clobbering /api/social snapshot
  if (typeof viral.getRouter === 'function') {
    app.use('/api/social/viral', viral.getRouter(admin));
  }

  // /api/enterprise/sales/*
  if (typeof enterprise.getRouter === 'function') {
    app.use('/api/enterprise/sales', enterprise.getRouter(admin));
  }

  // /api/catalog/products + /api/orders/*
  const catR = express.Router();
  catR.get('/products', (req, res) => res.json({ items: catalog.list(), btcAddress: BTC_ADDRESS }));
  catR.get('/products/:id', (req, res) => {
    const s = catalog.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'sku_not_found' });
    res.json(s);
  });
  catR.get('/status', (req, res) => res.json(catalog.getStatus()));
  app.use('/api/catalog', catR);

  const ordR = express.Router();
  ordR.get('/status', (req, res) => res.json(orders.getStatus()));
  ordR.get('/', admin, (req, res) => res.json({ orders: orders.list({ limit: Number(req.query.limit) || 50 }) }));
  ordR.get('/:id', (req, res) => {
    const o = orders.get(req.params.id);
    if (!o) return res.status(404).json({ error: 'order_not_found' });
    res.json(o);
  });
  ordR.post('/reserve', async (req, res) => {
    try { res.status(201).json(orders.reserve(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
  });
  ordR.post('/:id/pay', auth, async (req, res) => {
    try { res.json(await orders.attachPayment(req.params.id, req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
  });
  ordR.post('/:id/confirm', admin, (req, res) => {
    try { res.json(orders.confirmPaid(req.params.id, { admin: true, txid: req.body && req.body.txid })); }
    catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
  });
  ordR.post('/sell', auth, async (req, res) => {
    try {
      // Public sell never auto-confirms BTC — capacity path only.
      res.status(201).json(await orders.sell({ ...(req.body || {}), confirm: false }));
    } catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
  });
  app.use('/api/orders', ordR);

  // BRAOS status
  app.get('/api/braos', (req, res) => res.json(getStatus()));
  app.get('/api/braos/model', (req, res) => res.json(capacityModel()));
  app.post('/api/braos/start', admin, (req, res) => res.json({ ok: true, modules: startAll(), model: capacityModel() }));

  state.aliasesMounted = true;
  return { mounted: true, aliases: ['/api/pay', '/api/global', '/api/market', '/api/wealth', '/api/revenue/modules', '/api/social/viral', '/api/enterprise/sales', '/api/catalog/products', '/api/orders', '/api/braos'] };
}

module.exports = {
  BTC_ADDRESS,
  MODULES,
  startAll,
  getStatus,
  capacityModel,
  mountAliases,
  start: startAll,
  init: startAll,
};
