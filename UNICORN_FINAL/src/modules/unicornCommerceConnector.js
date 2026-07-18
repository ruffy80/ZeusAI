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
    title: 'Intent-to-Revenue Compiler — Architecture Pack',
    priceUsd: 2499,
    kpi: 'engagement kickoff for BTC checkout design',
    description: 'Engagement kickoff / architecture pack: maps market demand, module capability and owner payout rules into a service-page blueprint. Not a finished compiler shipped on payment — activation pack + milestone kickoff.',
  },
  {
    id: 'self-pricing-value-oracle',
    title: 'Self-Pricing Value Oracle — Architecture Pack',
    priceUsd: 3999,
    kpi: 'pricing architecture engagement',
    description: 'Engagement kickoff / architecture pack: outcome-value pricing model, transparent bandit rules and owner-approval gates. Delivered as a design + activation pack, not a finished oracle appliance.',
  },
  {
    id: 'autonomous-trust-negotiator',
    title: 'Autonomous Trust Negotiator — Architecture Pack',
    priceUsd: 5499,
    kpi: 'enterprise trust pack kickoff',
    description: 'Engagement kickoff / architecture pack: assembles DPA, security proof, ledger evidence and delivery guarantees into a buyer-specific trust blueprint. Human-led engagement follows.',
  },
  {
    id: 'living-service-dna',
    title: 'Living Service DNA — Architecture Pack',
    priceUsd: 7999,
    kpi: 'service manifest architecture',
    description: 'Engagement kickoff / architecture pack: signed service-manifest design and evolution rules. Not a finished self-evolving product shipped on payment.',
  },
  {
    id: 'zero-friction-sovereign-checkout',
    title: 'Zero-Friction Sovereign Checkout — Architecture Pack',
    priceUsd: 2999,
    kpi: 'BTC checkout architecture kickoff',
    description: 'Engagement kickoff / architecture pack: BTC invoice, proof, delivery preview and recovery sequence design. Activation pack on purchase; implementation is milestone-based.',
  },
  {
    id: 'world-standard-autonomous-franchise',
    title: 'World Standard Autonomous Franchise — Architecture Pack',
    priceUsd: 14999,
    kpi: 'franchise architecture engagement',
    description: 'Engagement kickoff / architecture pack: catalog, trust, checkout, delivery and customer-success blueprint for a sovereign franchise. Not a turnkey finished franchise OS on payment.',
  },
  {
    id: 'post-human-ops-board',
    title: 'Post-Human Ops Board — Architecture Pack',
    priceUsd: 9999,
    kpi: 'ops governance architecture',
    description: 'Engagement kickoff / architecture pack: explainable autonomous-decision board design with owner veto and BTC payout constraints. Delivered as a kickoff pack, not a finished ops appliance.',
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