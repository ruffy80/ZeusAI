'use strict';

const DEFAULT_BTC_WALLET = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const REQUIRED_CAPABILITIES = [
  {
    id: 'high-ticket-offer-packaging',
    title: 'High-Ticket Offer Packaging',
    existingModules: ['billion-scale-revenue-engine', 'strategic-package-engine', 'offer-factory', 'unicorn-commerce-connector'],
    fallbackModules: ['unicorn-high-ticket-offer-router'],
    outcome: 'enterprise packages become checkout-ready BTC offers',
  },
  {
    id: 'autonomous-sales-pipeline',
    title: 'Autonomous Sales Pipeline',
    existingModules: ['autonomous-money-machine', 'autonomous-revenue-commander', 'ai-sdr-agent', 'ai-sales-closer-pro', 'autonomous-bd-engine'],
    fallbackModules: ['unicorn-enterprise-pipeline-activator'],
    outcome: 'leads, objections, proposals and follow-ups move through one sales loop',
  },
  {
    id: 'btc-revenue-settlement',
    title: 'BTC Revenue Settlement',
    existingModules: ['sovereign-btc-commerce-bridge', 'quantumPaymentNexus', 'billing-engine', 'tenant-billing', 'paymentGateway'],
    fallbackModules: ['unicorn-owner-payout-sentinel'],
    outcome: 'revenue routes to the owner BTC wallet with payout invariants',
  },
  {
    id: 'marketplace-take-rate',
    title: 'Marketplace Take-Rate Engine',
    existingModules: ['serviceMarketplace', 'third-party-module-marketplace', 'module-to-marketplace-sync', 'referralEngine', 'dynamic-pricing'],
    fallbackModules: ['unicorn-gmv-take-rate-router'],
    outcome: 'modules, vendors and affiliates become a revenue-share marketplace',
  },
  {
    id: 'enterprise-deal-desk',
    title: 'Enterprise Deal Desk',
    existingModules: ['enterprisePartnership', 'enterprise-deal-desk', 'legalFortress', 'global-compliance-autopilot', 'transparency-ledger'],
    fallbackModules: ['unicorn-procurement-readiness-engine'],
    outcome: 'enterprise buyers get proposal, compliance, trust and procurement readiness',
  },
  {
    id: 'delivery-and-provisioning',
    title: 'Delivery and Provisioning',
    existingModules: ['provisioning-engine', 'tenant-provisioning', 'global-api-gateway', 'tenant-manager', 'saas-orchestrator-v4'],
    fallbackModules: ['unicorn-enterprise-delivery-router'],
    outcome: 'paid offers can be delivered as SaaS, API, tenant or private deployment',
  },
  {
    id: 'proof-kpi-dashboard',
    title: 'Proof and KPI Dashboard',
    existingModules: ['owner-revenue-dashboard', 'kpi-analytics', 'profit-attribution', 'profit-control-loop', 'revenueModules'],
    fallbackModules: ['unicorn-case-study-proof-engine'],
    outcome: 'owner sees pipeline, ARR, BTC received, GMV, margin and proof metrics',
  },
  {
    id: 'growth-seo-distribution',
    title: 'Growth, SEO and Distribution',
    existingModules: ['programmatic-seo-engine', 'seo-optimizer', 'auto-marketing', 'socialViralizer', 'autoViralGrowth'],
    fallbackModules: ['unicorn-vertical-demand-engine'],
    outcome: 'vertical pages, SEO templates and outbound campaigns feed enterprise demand',
  },
];

const GENERATED_CONTROL_MODULES = [
  {
    id: 'billion-scale-activation-orchestrator',
    title: 'Billion-Scale Activation Orchestrator',
    purpose: 'Connects all existing Unicorn revenue modules into one verifiable activation graph.',
  },
  {
    id: 'unicorn-capability-router',
    title: 'Unicorn Capability Router',
    purpose: 'Routes each business capability to existing modules first and generated control modules only when needed.',
  },
  {
    id: 'unicorn-case-study-proof-engine',
    title: 'Unicorn Case Study Proof Engine',
    purpose: 'Turns delivery metrics into proof assets, ROI baselines and enterprise case-study evidence.',
  },
  {
    id: 'unicorn-vertical-demand-engine',
    title: 'Unicorn Vertical Demand Engine',
    purpose: 'Creates vertical demand pages and commercial activation plans for enterprise acquisition.',
  },
];

function normalizeRegistry(registry = {}) {
  const categories = registry.categories || {};
  const modules = new Map();
  for (const [category, value] of Object.entries(categories)) {
    const names = Array.isArray(value) ? value : (Array.isArray(value.modules) ? value.modules : []);
    for (const name of names) modules.set(String(name), category);
  }
  return modules;
}

function moduleActive(moduleName, registryMap) {
  if (registryMap.has(moduleName)) return true;
  const normalized = String(moduleName).toLowerCase();
  for (const existingName of registryMap.keys()) {
    if (String(existingName).toLowerCase() === normalized) return true;
  }
  return false;
}

function buildActivationGraph(options = {}) {
  const registryMap = normalizeRegistry(options.registry || {});
  const capabilities = REQUIRED_CAPABILITIES.map((capability) => {
    const activeExisting = capability.existingModules.filter((moduleName) => moduleActive(moduleName, registryMap));
    const missingExisting = capability.existingModules.filter((moduleName) => !moduleActive(moduleName, registryMap));
    const generated = capability.fallbackModules.filter((moduleName) => !moduleActive(moduleName, registryMap));
    return {
      ...capability,
      status: activeExisting.length >= Math.min(3, capability.existingModules.length) ? 'activated-existing-modules' : 'activated-with-generated-control',
      activeExisting,
      missingExisting,
      generatedControlModules: generated,
      activationScore: Number(((activeExisting.length / capability.existingModules.length) * 100).toFixed(2)),
    };
  });
  const activatedExistingModules = [...new Set(capabilities.flatMap((capability) => capability.activeExisting))];
  const missingExistingModules = [...new Set(capabilities.flatMap((capability) => capability.missingExisting))];
  const generatedControlModules = GENERATED_CONTROL_MODULES.map((item) => ({ ...item, status: moduleActive(item.id, registryMap) ? 'registered' : 'generated-runtime-control' }));
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    status: 'unicorn-billion-scale-modules-activated',
    capabilities,
    summary: {
      capabilityCount: capabilities.length,
      activatedExistingModules: activatedExistingModules.length,
      missingExistingModules: missingExistingModules.length,
      generatedControlModules: generatedControlModules.length,
      averageActivationScore: Number((capabilities.reduce((sum, capability) => sum + capability.activationScore, 0) / capabilities.length).toFixed(2)),
    },
    activatedExistingModules,
    missingExistingModules,
    generatedControlModules,
    guardrail: 'Activation wires existing Unicorn modules and creates only control-plane modules; revenue still requires real buyers, distribution, delivery and proof.',
  };
}

function activationStatus(options = {}) {
  const graph = buildActivationGraph(options);
  return {
    ok: true,
    status: graph.status,
    generatedAt: graph.generatedAt,
    payout: { rail: 'btc-direct', btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, automatic: true },
    summary: graph.summary,
    topCapabilities: graph.capabilities.map((capability) => ({ id: capability.id, status: capability.status, activationScore: capability.activationScore })),
    guardrail: graph.guardrail,
  };
}

function activationRun(input = {}, options = {}) {
  const graph = buildActivationGraph(options);
  const selectedPackage = String(input.packageId || 'zeusai-sovereign-ai-private-deployment');
  const company = String(input.company || 'Strategic Buyer').slice(0, 120);
  return {
    ok: true,
    runId: `activation_${Date.now().toString(36)}`,
    status: 'activation-plan-ready',
    company,
    selectedPackage,
    payout: { rail: 'btc-direct', btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, automatic: true },
    steps: [
      'use billion-scale packages as primary offers',
      'route buyer intent to autonomous SDR and closer',
      'issue BTC-direct enterprise proposal',
      'provision delivery through SaaS/API/private deployment modules',
      'capture KPI proof and convert into case study',
      'publish vertical demand pages and marketplace listings',
    ],
    graph,
  };
}

function buildActivationProducts(options = {}) {
  const wallet = options.btcWallet || DEFAULT_BTC_WALLET;
  return [
    {
      id: 'unicorn-billion-scale-activation',
      title: 'Unicorn Billion-Scale Activation Layer',
      group: 'billion-scale-activation',
      category: 'strategic-enterprise',
      segment: 'enterprise',
      priceUsd: 500000,
      currency: 'USD',
      billing: 'project',
      kpi: 'activated revenue modules and enterprise pipeline readiness',
      description: 'Activates existing Unicorn modules into one enterprise revenue, marketplace, delivery, KPI and BTC payout control layer.',
      buyUrl: '/checkout?serviceId=unicorn-billion-scale-activation&amount=500000&plan=unicorn-billion-scale-activation',
      checkout: { method: 'btc-direct', btcAddress: wallet, payoutOwner: options.ownerName || 'Vladoi Ionut' },
      delivery: { mode: 'activation-orchestrator', endpoint: '/api/billion-scale/activation/run', proof: 'activation graph + module map + KPI baseline + BTC invoice' },
      guardrails: ['does not guarantee revenue without buyers', 'uses existing modules first', 'owner approval required for external spend'],
    },
  ];
}

module.exports = {
  REQUIRED_CAPABILITIES,
  GENERATED_CONTROL_MODULES,
  buildActivationGraph,
  activationStatus,
  activationRun,
  buildActivationProducts,
};