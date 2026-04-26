'use strict';

const DEFAULT_BTC_WALLET = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const STRATEGIC_PACKAGES = [
  {
    id: 'zeusai-revenue-machine',
    title: 'ZeusAI Revenue Machine',
    priceUsd: 25000,
    target: 'B2B companies that need leads, offers, checkout recovery and measurable revenue lift',
    promise: 'Launch an autonomous sales-and-conversion operating loop with BTC-direct checkout and ROI proof.',
    modules: ['Autonomous Revenue Commander', 'Offer Factory', 'Conversion Intelligence', 'Checkout Recovery', 'AI SDR', 'AI Sales Closer'],
  },
  {
    id: 'zeusai-autonomous-saas-os',
    title: 'ZeusAI Autonomous SaaS OS',
    priceUsd: 75000,
    target: 'founders, agencies and SaaS teams that want a productized autonomous platform',
    promise: 'Deploy catalog, billing, delivery, customer success, API gateway and module automation as one SaaS OS.',
    modules: ['Unicorn Commerce Connector', 'Billing Engine', 'Provisioning Engine', 'SaaS Orchestrator', 'Customer Success Autopilot'],
  },
  {
    id: 'zeusai-enterprise-trust-automation',
    title: 'ZeusAI Enterprise Trust & Automation',
    priceUsd: 150000,
    target: 'enterprise buyers that require compliance, security proof, auditability and automation',
    promise: 'Package trust center, DPA, passkeys, transparency ledger, compliance autopilot and AI automation for enterprise procurement.',
    modules: ['Passkeys', 'Transparency Ledger', 'Compliance Autopilot', 'Backup Proof', 'Vendor Quarantine', 'Enterprise Partnership'],
  },
  {
    id: 'zeusai-marketplace-franchise',
    title: 'ZeusAI Marketplace Franchise',
    priceUsd: 250000,
    target: 'platform operators and regional partners that want a module marketplace with revenue share',
    promise: 'Launch a quarantined module marketplace with BTC settlement, vendor policy, revenue share and service manifests.',
    modules: ['Service Marketplace', 'Third-Party Module Marketplace', 'Revenue Share', 'Referral Engine', 'Dynamic Pricing'],
  },
  {
    id: 'zeusai-sovereign-ai-private-deployment',
    title: 'ZeusAI Sovereign AI Private Deployment',
    priceUsd: 1000000,
    target: 'large enterprises, funds, governments and strategic operators needing private AI infrastructure',
    promise: 'Private deployment of the Unicorn stack with owner-controlled BTC settlement, governance, resilience and custom modules.',
    modules: ['Unicorn Mesh Orchestrator', 'Quantum Vault', 'Global API Gateway', 'Tenant SaaS', 'Resilience Core', 'Legal Fortress'],
  },
];

const VERTICALS = ['fintech', 'ecommerce', 'legaltech', 'healthtech', 'manufacturing', 'real-estate', 'cybersecurity', 'logistics', 'education', 'energy', 'government', 'creator-economy'];

function packageWithCommerceFields(pkg, options = {}) {
  const wallet = options.btcWallet || DEFAULT_BTC_WALLET;
  return {
    ...pkg,
    group: 'billion-scale-package',
    category: 'strategic-enterprise',
    segment: 'enterprise',
    currency: 'USD',
    billing: 'annual-or-project',
    status: 'enterprise-ready-offer',
    kpi: pkg.id.includes('marketplace') ? 'platform GMV and take-rate' : pkg.id.includes('revenue') ? 'recovered and generated revenue' : 'enterprise automation ROI',
    description: `${pkg.promise} Built from Unicorn modules and settled through owner-controlled BTC payout.`,
    buyUrl: `/checkout?serviceId=${encodeURIComponent(pkg.id)}&amount=${pkg.priceUsd}&plan=${encodeURIComponent(pkg.id)}`,
    checkout: { method: 'btc-direct', btcAddress: wallet, payoutOwner: options.ownerName || 'Vladoi Ionut' },
    delivery: { mode: 'enterprise-deal-desk', proof: 'signed proposal + BTC invoice + phased delivery plan + success metrics', endpoint: '/api/billion-scale/deal-desk/proposal' },
    guardrails: ['no revenue guarantee without signed customer baseline', 'human owner approval for external spend', 'enterprise terms required for regulated industries'],
  };
}

function buildStrategicPackages(options = {}) {
  return STRATEGIC_PACKAGES.map((pkg) => packageWithCommerceFields(pkg, options));
}

function marketplaceEconomics(input = {}) {
  const gmvUsd = Number(input.gmvUsd || 5000000000);
  const takeRate = Number(input.takeRate || 0.2);
  const vendorCount = Number(input.vendorCount || 10000);
  const annualRevenueUsd = Math.round(gmvUsd * takeRate);
  return {
    ok: true,
    model: 'marketplace-gmv-take-rate',
    gmvUsd,
    takeRate,
    vendorCount,
    annualRevenueUsd,
    pathToBillionUsd: annualRevenueUsd >= 1000000000 ? 'achieved-at-this-scale' : `needs ${Math.ceil(1000000000 / Math.max(1, annualRevenueUsd))}x more GMV or take-rate`,
    requiredControls: ['vendor quarantine', 'quality scoring', 'payment settlement proof', 'refund policy', 'revenue-share ledger'],
  };
}

function ownerRevenueDashboard(options = {}) {
  const catalogCount = Number(options.catalogCount || 413);
  const registryCount = Number(options.registryCount || 314);
  const pipeline = buildStrategicPackages(options).map((pkg) => ({
    packageId: pkg.id,
    priceUsd: pkg.priceUsd,
    targetDealsFor10M: Math.ceil(10000000 / pkg.priceUsd),
    targetDealsFor100M: Math.ceil(100000000 / pkg.priceUsd),
    targetDealsFor1B: Math.ceil(1000000000 / pkg.priceUsd),
  }));
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    payout: { rail: 'btc-direct', btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, automatic: true },
    inventory: { catalogCount, registryCount, strategicPackageCount: STRATEGIC_PACKAGES.length },
    kpisNeeded: ['MRR', 'ARR', 'pipeline value', 'qualified leads', 'proposal win rate', 'BTC received', 'delivery margin', 'churn', 'marketplace GMV'],
    pipelineMath: pipeline,
    immediateFocus: ['sell enterprise packages instead of hundreds of small modules', 'build case studies', 'track ROI per customer', 'create partner/channel sales', 'convert marketplace into take-rate business'],
  };
}

function dealDeskProposal(input = {}, options = {}) {
  const packageId = String(input.packageId || 'zeusai-revenue-machine');
  const selected = buildStrategicPackages(options).find((pkg) => pkg.id === packageId) || buildStrategicPackages(options)[0];
  const company = String(input.company || 'Strategic Buyer').slice(0, 120);
  const seats = Math.max(1, Number(input.seats || 1));
  const multiplier = selected.priceUsd >= 250000 ? 1 : Math.min(3, 1 + (seats - 1) * 0.08);
  const proposedUsd = Math.round(selected.priceUsd * multiplier);
  return {
    ok: true,
    proposalId: `deal_${Date.now().toString(36)}_${packageId}`,
    company,
    package: selected,
    proposedUsd,
    btcCheckout: { btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, checkoutUrl: `/checkout?serviceId=${encodeURIComponent(packageId)}&amount=${proposedUsd}&plan=${encodeURIComponent(packageId)}` },
    terms: ['50% BTC deposit to start', 'phased delivery milestones', 'success metrics defined before launch', 'owner approval for paid outbound spend'],
    nextActions: ['book enterprise discovery', 'confirm buyer baseline metrics', 'issue signed BTC invoice', 'start delivery workspace'],
  };
}

function verticalGrowthPages() {
  return {
    ok: true,
    count: VERTICALS.length,
    pages: VERTICALS.map((vertical) => ({
      slug: `/enterprise/${vertical}-autonomous-revenue-machine`,
      title: `Autonomous Revenue Machine for ${vertical}`,
      targetPackage: vertical === 'legaltech' || vertical === 'healthtech' ? 'zeusai-enterprise-trust-automation' : 'zeusai-revenue-machine',
      cta: '/api/billion-scale/deal-desk/proposal',
      intent: 'enterprise-commercial',
    })),
  };
}

function status(options = {}) {
  const packages = buildStrategicPackages(options);
  return {
    ok: true,
    status: 'billion-scale-foundation-live',
    generatedAt: new Date().toISOString(),
    packageCount: packages.length,
    minPackageUsd: Math.min(...packages.map((pkg) => pkg.priceUsd)),
    maxPackageUsd: Math.max(...packages.map((pkg) => pkg.priceUsd)),
    payout: { rail: 'btc-direct', btcAddress: options.btcWallet || DEFAULT_BTC_WALLET, automatic: true },
    engines: ['strategic packages', 'enterprise deal desk', 'owner revenue dashboard', 'marketplace economics', 'vertical growth pages'],
    caveat: 'This creates the commercial infrastructure for billion-scale revenue; actual revenue requires customers, distribution, proof, delivery and compliance.',
  };
}

module.exports = {
  buildStrategicPackages,
  marketplaceEconomics,
  ownerRevenueDashboard,
  dealDeskProposal,
  verticalGrowthPages,
  status,
};
