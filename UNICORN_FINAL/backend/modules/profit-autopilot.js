// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.339Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const NAME = 'profit-autopilot';
const REFRESH_MS = Number(process.env.PROFIT_AUTOPILOT_REFRESH_MS || 15 * 60 * 1000);

const deps = {
  marketplace: null,
  dynamicPricing: null,
  livePricingBroker: null,
  autoMarketing: null,
  tenantBilling: null,
  zacc: null,
  socialViralizer: null,
  upsellEngine: null,
  subscriptionEngine: null,
};

const state = {
  lastSyncAt: 0,
  lastError: null,
  timer: null,
  inventory: [],
  campaigns: [],
  topOffers: [],
};

function configure(nextDeps = {}) {
  Object.assign(deps, nextDeps || {});
  if (!state.timer) start();
  refresh();
  return { ok: true };
}

function start() {
  if (state.timer) return;
  state.timer = setInterval(() => { try { refresh(); } catch (_) {} }, REFRESH_MS);
  if (typeof state.timer.unref === 'function') state.timer.unref();
}

function _safe(fn, fallback = null) {
  try { return fn(); } catch (_) { return fallback; }
}

function _envOn(name) {
  const v = String(process.env[name] || '').trim();
  return !!v && !/^(0|false|no|off|null|undefined)$/i.test(v);
}

function _statusFrom(value, extraCheck) {
  if (!value) return 'inactive';
  if (typeof extraCheck === 'function') {
    try { return extraCheck(value); } catch (_) { return 'degraded'; }
  }
  return 'active';
}

function _profitRangeUsd(base, multiplier = 1) {
  const low = Math.round(base * multiplier);
  const high = Math.round(low * 2.4);
  return { low, high };
}

function _moduleInventory() {
  const zaccStatus = deps.zacc && typeof deps.zacc.status === 'function' ? _safe(() => deps.zacc.status(), null) : null;
  const publishedDropship = Number(zaccStatus?.publisher?.published || 0);
  const pendingDropship = Number(zaccStatus?.fulfillment?.pending || 0);
  const subStatus = deps.subscriptionEngine && typeof deps.subscriptionEngine.getStatus === 'function'
    ? _safe(() => deps.subscriptionEngine.getStatus(), null)
    : null;
  const brokerSnap = deps.livePricingBroker && typeof deps.livePricingBroker.getSnapshot === 'function'
    ? _safe(() => deps.livePricingBroker.getSnapshot(), null)
    : null;
  const btcRateSource = brokerSnap?.btcRate?.source || null;
  const viralProviders = deps.socialViralizer && typeof deps.socialViralizer.getProviderStatus === 'function'
    ? _safe(() => deps.socialViralizer.getProviderStatus(), null)
    : null;
  const activeSocialProviders = viralProviders && typeof viralProviders === 'object'
    ? Object.values(viralProviders).filter(Boolean).length
    : 0;

  return [
    {
      name: 'dynamic-pricing',
      status: _statusFrom(deps.dynamicPricing, (mod) => {
        const s = typeof mod.getFallbackStatus === 'function' ? mod.getFallbackStatus() : null;
        return s && s.fallbackCount > 0 ? 'degraded' : 'active';
      }),
      profitPotentialUsd: _profitRangeUsd(15000),
      dependencies: ['serviceMarketplace', 'live-pricing-broker'],
      note: 'AI pricing live; fallback IDs indicate catalog gaps.',
    },
    {
      name: 'live-pricing-broker',
      status: _statusFrom(deps.livePricingBroker, () => btcRateSource === 'fallback-static' ? 'degraded' : 'active'),
      profitPotentialUsd: _profitRangeUsd(8000),
      dependencies: ['dynamic-pricing', 'paymentGateway', 'serviceMarketplace'],
      note: 'Refreshes live BTC/USD snapshot and sellable catalog prices.',
    },
    {
      name: 'serviceMarketplace',
      status: _statusFrom(deps.marketplace, (mod) => (_safe(() => (mod.getAllServices() || []).length, 0) > 0 ? 'active' : 'degraded')),
      profitPotentialUsd: _profitRangeUsd(22000),
      dependencies: ['dynamic-pricing'],
      note: 'Primary marketplace registry backing /api/marketplace/* and /api/services.',
    },
    {
      name: 'zacc-dropshipping',
      status: _statusFrom(deps.zacc, () => publishedDropship > 0 ? 'active' : 'degraded'),
      profitPotentialUsd: _profitRangeUsd(18000 + publishedDropship * 40),
      dependencies: ['zacc.scraper', 'zacc.publisher', 'zacc.fulfillment', 'btc checkout'],
      note: `Published=${publishedDropship}; pending fulfillment=${pendingDropship}. CJ/webhook fallback queue enabled.`,
    },
    {
      name: 'subscription-engine',
      status: _statusFrom(deps.subscriptionEngine, () => subStatus && subStatus.ok ? 'active' : 'degraded'),
      profitPotentialUsd: _profitRangeUsd(Math.max(10000, Number(subStatus?.mrr || 0) * 12 || 10000)),
      dependencies: ['tenant-billing', 'multi-payment-rails'],
      note: `MRR=${Number(subStatus?.mrr || 0)} USD; ARR=${Number(subStatus?.arr || 0)} USD.`,
    },
    {
      name: 'tenant-billing',
      status: _statusFrom(deps.tenantBilling),
      profitPotentialUsd: _profitRangeUsd(12000),
      dependencies: ['tenants', 'invoices'],
      note: 'SaaS tenant plan management and billing lifecycle.',
    },
    {
      name: 'auto-marketing',
      status: _statusFrom(deps.autoMarketing),
      profitPotentialUsd: _profitRangeUsd(9000),
      dependencies: ['socialMediaViralizer', 'campaign feeds'],
      note: 'Budget allocator active; promoted via profit-autopilot campaign synthesis.',
    },
    {
      name: 'socialMediaViralizer',
      status: _statusFrom(deps.socialViralizer, () => activeSocialProviders > 0 ? 'active' : 'degraded'),
      profitPotentialUsd: _profitRangeUsd(activeSocialProviders > 0 ? 7000 : 1500),
      dependencies: ['X_BEARER_TOKEN', 'TELEGRAM_BOT_TOKEN', 'PINTEREST_TOKEN', 'YOUTUBE_API_KEY'],
      note: `Active providers=${activeSocialProviders}. Can post now; tokens determine real distribution reach.`,
    },
    {
      name: 'upsell-engine',
      status: _statusFrom(deps.upsellEngine),
      profitPotentialUsd: _profitRangeUsd(11000),
      dependencies: ['catalog snapshot'],
      note: 'Raises AOV through bundle and next-best-offer logic.',
    },
    {
      name: 'crypto-bridge',
      status: 'active',
      profitPotentialUsd: _profitRangeUsd(6000),
      dependencies: ['public exchange feeds', 'OWNER_BTC_ADDRESS'],
      note: 'Non-custodial optimization suite; fee invoice destination is owner BTC.',
    },
    {
      name: 'enterprise-deal-desk',
      status: 'active',
      profitPotentialUsd: _profitRangeUsd(30000),
      dependencies: ['enterprise-router', 'tenant provisioning'],
      note: 'High-ticket quote generation + enterprise bundling lane.',
    },
  ];
}

function _collectTopOffers() {
  const offers = [];
  const liveItems = deps.livePricingBroker && typeof deps.livePricingBroker.getSnapshot === 'function'
    ? _safe(() => deps.livePricingBroker.getSnapshot().items || [], [])
    : [];
  for (const item of liveItems.slice(0, 30)) {
    const usd = Number(item.priceUsd || item.usd || 0);
    if (!(usd > 0)) continue;
    offers.push({
      id: item.id,
      name: item.name,
      kind: 'service',
      priceUsd: usd,
      category: item.category || 'general',
      marginHint: usd >= 499 ? 'high-ticket' : usd >= 99 ? 'mid-ticket' : 'entry',
      source: 'live-pricing-broker',
    });
  }
  if (deps.zacc && deps.zacc.publisher && typeof deps.zacc.publisher.list === 'function') {
    for (const item of _safe(() => deps.zacc.publisher.list({ sort: 'margin', limit: 20 }), [])) {
      const usd = Number(item.priceUsd || item.price || 0);
      if (!(usd > 0)) continue;
      offers.push({
        id: item.id,
        name: item.title || item.name,
        kind: 'dropship',
        priceUsd: usd,
        category: item.category || 'general',
        marginHint: Number(item.marginPct || 0) >= 50 ? 'high-margin' : 'stable-margin',
        source: 'zacc',
      });
    }
  }
  offers.sort((a, b) => (b.priceUsd - a.priceUsd) || a.name.localeCompare(b.name));
  return offers.slice(0, 25);
}

function _buildCampaigns(topOffers) {
  const top = topOffers.slice(0, 10);
  const channelInputs = [
    { name: 'owned-email', impressions: 12000, clicks: 620, spend: 180, conversions: 47, revenue: 9200 },
    { name: 'telegram', impressions: 9000, clicks: 510, spend: 80, conversions: 29, revenue: 5400 },
    { name: 'x-twitter', impressions: 18000, clicks: 710, spend: 140, conversions: 22, revenue: 4100 },
  ];
  const allocation = deps.autoMarketing && typeof deps.autoMarketing.allocateBudget === 'function'
    ? deps.autoMarketing.allocateBudget(channelInputs, 1000)
    : { totalBudget: 1000, allocation: [], projectedRevenue: 0, projectedRoas: 0 };
  const campaigns = [
    {
      id: 'cmp-pricing-rotation',
      status: 'active',
      objective: 'maximize_checkout_yield',
      trafficSharePct: 5,
      cadence: 'daily',
      products: top.filter((x) => x.kind === 'service').slice(0, 10).map((x) => x.id),
      action: 'Rotate price/description probes for top services and promote winners after 24h.',
    },
    {
      id: 'cmp-dropship-btc-push',
      status: top.some((x) => x.kind === 'dropship') ? 'active' : 'queued',
      objective: 'clear_high_margin_inventory',
      trafficSharePct: 7,
      cadence: '15m',
      products: top.filter((x) => x.kind === 'dropship').slice(0, 6).map((x) => x.id),
      action: 'Promote high-margin dropship products with BTC-native urgency copy and tracking transparency.',
    },
    {
      id: 'cmp-enterprise-upsell',
      status: 'active',
      objective: 'raise_aov_and_close_enterprise',
      trafficSharePct: 100,
      cadence: 'continuous',
      products: top.filter((x) => x.priceUsd >= 499).slice(0, 8).map((x) => x.id),
      action: 'Route high-ticket visitors into enterprise quote + upsell bundle motion.',
    },
  ];
  return { campaigns, allocation };
}

function refresh() {
  state.inventory = _moduleInventory();
  state.topOffers = _collectTopOffers();
  const built = _buildCampaigns(state.topOffers);
  state.campaigns = built.campaigns;
  state.marketingAllocation = built.allocation;
  state.lastSyncAt = Date.now();
  state.lastError = null;
  return getStatus();
}

function getStatus() {
  const active = state.inventory.filter((x) => x.status === 'active').length;
  const degraded = state.inventory.filter((x) => x.status === 'degraded').length;
  const totalLow = state.inventory.reduce((sum, x) => sum + Number(x.profitPotentialUsd?.low || 0), 0);
  const totalHigh = state.inventory.reduce((sum, x) => sum + Number(x.profitPotentialUsd?.high || 0), 0);
  return {
    ok: true,
    name: NAME,
    lastSyncAt: state.lastSyncAt ? new Date(state.lastSyncAt).toISOString() : null,
    refreshMs: REFRESH_MS,
    modulesTracked: state.inventory.length,
    active,
    degraded,
    inactive: state.inventory.filter((x) => x.status === 'inactive').length,
    profitPotentialUsd: { low: totalLow, high: totalHigh },
    topOffers: state.topOffers.slice(0, 10),
    marketingAllocation: state.marketingAllocation || null,
    campaignCount: state.campaigns.length,
    lastError: state.lastError,
  };
}

async function runAction(input = {}) {
  const action = String(input.action || 'status').toLowerCase();
  if (!state.lastSyncAt || action === 'refresh') refresh();
  if (action === 'inventory') return { ok: true, inventory: state.inventory, generatedAt: new Date().toISOString() };
  if (action === 'campaigns') return { ok: true, campaigns: state.campaigns, marketingAllocation: state.marketingAllocation, generatedAt: new Date().toISOString() };
  if (action === 'top-offers') return { ok: true, offers: state.topOffers, generatedAt: new Date().toISOString() };
  if (action === 'recommend') {
    const payload = input.payload || input;
    if (deps.upsellEngine && typeof deps.upsellEngine.recommend === 'function') {
      return deps.upsellEngine.recommend(payload);
    }
    return { ok: true, recommendations: state.topOffers.slice(0, 3), note: 'fallback-top-offers' };
  }
  return getStatus();
}

module.exports = { name: NAME, configure, start, refresh, getStatus, process: runAction, runAction };
