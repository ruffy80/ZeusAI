'use strict';

const crypto = require('crypto');

const DEFAULT_BTC_WALLET = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const CATEGORY_PRICE = {
  orchestrator: 899,
  shield: 799,
  healthDaemon: 399,
  watchdog: 349,
  ai: 699,
  dynamic: 149,
  engines: 249,
  generated: 1299,
  internal: 499,
  external: 599,
  saas: 799,
};

const FUTURE_PRIMITIVES = [
  {
    id: 'intent-to-revenue-compiler',
    title: 'Intent-to-Revenue Compiler',
    priceUsd: 2499,
    kpi: 'turns buyer intent into BTC checkout flows',
    description: 'Future primitive: compiles market demand, module capability and owner payout rules into a ready-to-sell service page.',
  },
  {
    id: 'self-pricing-value-oracle',
    title: 'Self-Pricing Value Oracle',
    priceUsd: 3999,
    kpi: 'prices services by delivered outcome',
    description: 'Future primitive: estimates outcome value and proposes transparent pricing while preserving owner approval and no-dark-pattern rules.',
  },
  {
    id: 'autonomous-trust-negotiator',
    title: 'Autonomous Trust Negotiator',
    priceUsd: 5499,
    kpi: 'enterprise trust-to-close acceleration',
    description: 'Future primitive: assembles DPA, security proof, ledger evidence and delivery guarantees into a buyer-specific trust pack.',
  },
  {
    id: 'living-service-dna',
    title: 'Living Service DNA',
    priceUsd: 7999,
    kpi: 'services evolve from usage signals',
    description: 'Future primitive: every sold service carries a signed manifest that can safely evolve with customer usage and module upgrades.',
  },
  {
    id: 'zero-friction-sovereign-checkout',
    title: 'Zero-Friction Sovereign Checkout',
    priceUsd: 2999,
    kpi: 'BTC-native checkout completion',
    description: 'Future primitive: buyer-friendly BTC invoice, proof, delivery preview and recovery sequence in one autonomous flow.',
  },
  {
    id: 'world-standard-autonomous-franchise',
    title: 'World Standard Autonomous Franchise',
    priceUsd: 14999,
    kpi: 'replicates ZeusAI revenue loops into new verticals',
    description: 'Future primitive: packages catalog, trust, checkout, delivery and customer success as a sovereign repeatable SaaS franchise.',
  },
  {
    id: 'post-human-ops-board',
    title: 'Post-Human Ops Board',
    priceUsd: 9999,
    kpi: 'owner-visible autonomous decisions',
    description: 'Future primitive: every autonomous revenue decision is explainable, reversible and tied to owner-defined BTC payout constraints.',
  },
];

function slug(value) {
  return String(value || 'module')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'module';
}

function titleize(value) {
  return slug(value).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function stablePrice(moduleName, category) {
  const base = CATEGORY_PRICE[category] || 399;
  const hash = crypto.createHash('sha256').update(`${category}:${moduleName}`).digest();
  const multiplier = 0.8 + ((hash[0] % 9) * 0.1);
  return Math.max(49, Math.round((base * multiplier) / 10) * 10 - 1);
}

function normalizeRegistry(registry) {
  const categories = registry && registry.categories ? registry.categories : {};
  const items = [];
  for (const [category, payload] of Object.entries(categories)) {
    const modules = Array.isArray(payload) ? payload : payload.modules;
    if (!Array.isArray(modules)) continue;
    for (const moduleName of modules) {
      items.push({ category, moduleName: String(moduleName) });
    }
  }
  return items;
}

function moduleToService(entry, options = {}) {
  const id = `unicorn-module-${slug(entry.moduleName)}`;
  const priceUsd = stablePrice(entry.moduleName, entry.category);
  const wallet = options.btcWallet || DEFAULT_BTC_WALLET;
  return {
    id,
    title: `${titleize(entry.moduleName)} Service`,
    group: 'unicorn-auto-module',
    category: entry.category,
    segment: entry.category === 'saas' ? 'enterprise' : 'modules',
    kpi: `${titleize(entry.category)} capability activation`,
    priceUsd,
    currency: 'USD',
    billing: 'one-time',
    status: 'auto-sellable',
    sourceModule: entry.moduleName,
    description: `${titleize(entry.moduleName)} packaged automatically from the live Unicorn module registry, BTC-settled and ready for autonomous delivery.`,
    buyUrl: `/checkout?serviceId=${encodeURIComponent(id)}&amount=${priceUsd}&plan=${encodeURIComponent(id)}`,
    checkout: { method: 'btc-direct', btcAddress: wallet, payoutOwner: options.ownerName || 'Vladoi Ionut' },
    delivery: { mode: 'auto-provisioned', proof: 'signed receipt + license/API key + onboarding manifest', endpoint: `/api/delivery/{receiptId}?serviceId=${encodeURIComponent(id)}` },
    autonomy: { listedAutomatically: true, futureSafe: true, ownerApprovalForExternalSpend: true },
  };
}

function buildFuturePrimitiveServices(options = {}) {
  const wallet = options.btcWallet || DEFAULT_BTC_WALLET;
  return FUTURE_PRIMITIVES.map((primitive) => ({
    ...primitive,
    group: 'future-invention',
    category: 'not-yet-invented',
    segment: 'frontier-rd',
    currency: 'USD',
    billing: 'one-time',
    status: 'sellable-rd-foundation',
    buyUrl: `/checkout?serviceId=${encodeURIComponent(primitive.id)}&amount=${primitive.priceUsd}&plan=${encodeURIComponent(primitive.id)}`,
    checkout: { method: 'btc-direct', btcAddress: wallet, payoutOwner: options.ownerName || 'Vladoi Ionut' },
    delivery: { mode: 'rd-pack', proof: 'concept manifest + implementation roadmap + owner-controlled rollout', endpoint: `/api/delivery/{receiptId}?serviceId=${encodeURIComponent(primitive.id)}` },
    autonomy: { listedAutomatically: true, speculative: true, claimsGuardrail: 'sold as frontier R&D foundation, not as completed impossible technology' },
  }));
}

function buildCommerceCatalog(options = {}) {
  const registryServices = normalizeRegistry(options.registry).map((entry) => moduleToService(entry, options));
  const futureServices = buildFuturePrimitiveServices(options);
  const items = [...registryServices, ...futureServices];
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'unicorn-commerce-connector',
    payout: { rail: 'btc-direct', btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, automatic: true, custody: 'owner-wallet' },
    counts: { total: items.length, registry: registryServices.length, futurePrimitives: futureServices.length },
    groups: ['unicorn-auto-module', 'future-invention'],
    items,
  };
}

function status(options = {}) {
  const catalog = buildCommerceCatalog(options);
  return {
    ok: true,
    status: 'live-autonomous-commerce-connector',
    generatedAt: new Date().toISOString(),
    sellsCurrentModules: catalog.counts.registry,
    sellsFuturePrimitives: catalog.counts.futurePrimitives,
    payout: catalog.payout,
    guarantees: ['new registry modules become service manifests automatically', 'BTC direct is the default payout rail', 'runtime data is never required in GitHub', 'future inventions are labeled as R&D foundations'],
  };
}

module.exports = {
  buildCommerceCatalog,
  buildFuturePrimitiveServices,
  status,
};