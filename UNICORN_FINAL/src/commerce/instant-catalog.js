// commerce/instant-catalog.js
// Small-ticket "pay in <60s" instant products. Seed is static (curated); each
// product has typed inputs that the /api/instant/purchase route validates.
//
// Exports: byId(id), publicView(), all()

const SEED = [
  {
    id: 'instant-website-audit',
    title: 'Instant Website Audit (AI)',
    tier: 'instant',
    priceUSD: 49,
    deliveryMinutes: 5,
    description: 'Full SEO + performance + accessibility audit, AI-generated, delivered in under 5 minutes.',
    inputs: [
      { key: 'url', label: 'Website URL', required: true, type: 'url' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-logo-kit',
    title: 'Instant Brand Logo Kit',
    tier: 'instant',
    priceUSD: 99,
    deliveryMinutes: 10,
    description: 'AI-generated logo + 5 variants + favicon + brand-color palette.',
    inputs: [
      { key: 'brandName', label: 'Brand Name', required: true, type: 'text' },
      { key: 'industry', label: 'Industry', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-pitch-deck',
    title: 'Instant Pitch Deck (10 slides)',
    tier: 'instant',
    priceUSD: 149,
    deliveryMinutes: 8,
    description: 'Investor-ready 10-slide deck generated from your one-paragraph idea.',
    inputs: [
      { key: 'idea', label: 'Startup Idea (1 paragraph)', required: true, type: 'textarea' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-saas-mvp',
    title: 'Professional SaaS MVP (1-week build)',
    tier: 'professional',
    priceUSD: 1999,
    deliveryDays: 7,
    description: 'Hand-built SaaS MVP with auth, billing, deployment.',
    inputs: [
      { key: 'spec', label: 'Product Spec', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-agent',
    title: 'Professional AI Agent (custom)',
    tier: 'professional',
    priceUSD: 2999,
    deliveryDays: 10,
    description: 'Custom AI agent: tool-calling, memory, deployed to your domain.',
    inputs: [
      { key: 'useCase', label: 'Use Case', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  }
];

const _byId = new Map(SEED.map(p => [p.id, p]));

function all() { return SEED.slice(); }
function byId(id) { return _byId.get(String(id || '')) || null; }
function publicView() {
  return SEED.map(p => ({
    id: p.id, title: p.title, tier: p.tier || 'instant',
    priceUSD: p.priceUSD, currency: 'USD',
    deliveryMinutes: p.deliveryMinutes, deliveryDays: p.deliveryDays,
    description: p.description,
    inputs: p.inputs || []
  }));
}

module.exports = { all, byId, publicView };
