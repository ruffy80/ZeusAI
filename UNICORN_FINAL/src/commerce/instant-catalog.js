// commerce/instant-catalog.js
// Small-ticket "pay in <60s" instant products. Seed is static (curated); each
// product has typed inputs that the /api/instant/purchase route validates.
//
// Exports: byId(id), publicView(), all()

// 18 products on 2 tiers (instant + professional). Combined with the 7
// enterprise-catalog products this gives the canonical 25-product / 3-tier
// catalogue the site contract guarantees.
const SEED = [
  // ---------- INSTANT (10) — pay-in-<60s, delivery in minutes/hours ----------
  {
    id: 'instant-website-audit',
    title: 'Instant Website Audit (AI)',
    tier: 'instant',
    priceUSD: 49,
    deliveryMinutes: 5,
    description: 'The file is a Markdown audit: scorecard, SEO, performance, accessibility, and a 30-day plan, written from your URL. No score is filled in unless a provider key is armed and the model writes one. The pack does not invent a measurement.',
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
    description: 'The checkout file is a Service Activation Pack with the brand kit written in: name candidates, positioning, taglines, voice, and a color and type direction. It does not include logo image files, a favicon, or visual variants.',
    inputs: [
      { key: 'brandName', label: 'Brand Name', required: true, type: 'text' },
      { key: 'industry', label: 'Industry', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-pitch-deck',
    title: 'Instant Pitch Deck',
    tier: 'instant',
    priceUSD: 149,
    deliveryMinutes: 8,
    description: 'The file is Markdown slide copy: problem, solution, market, product, and ask, written from your brief. A provider key can replace that copy. It is not a designed slide deck.',
    inputs: [
      { key: 'idea', label: 'Startup Idea (1 paragraph)', required: true, type: 'textarea' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-seo-content-pack',
    title: 'Instant SEO Content Pack',
    tier: 'instant',
    priceUSD: 79,
    deliveryMinutes: 12,
    description: 'The file is one Markdown article with keywords, a title, a meta description, and internal-link ideas, written from your brief. A provider key can replace that copy. It does not claim a ranking.',
    inputs: [
      { key: 'niche', label: 'Niche / Industry', required: true, type: 'text' },
      { key: 'keywords', label: 'Target keywords (comma-separated)', required: true, type: 'textarea' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-landing-page',
    title: 'Instant Landing Page (HTML + copy)',
    tier: 'instant',
    priceUSD: 199,
    deliveryMinutes: 15,
    description: 'The file is one self-contained HTML page: hero, benefits, FAQ, and a call to action, written from your brief. A provider key can replace that copy. It is not a hosted site.',
    inputs: [
      { key: 'productName', label: 'Product / Service Name', required: true, type: 'text' },
      { key: 'valueProp', label: 'Value proposition (1–2 sentences)', required: true, type: 'textarea' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-brand-voice',
    title: 'Instant Brand Voice & Messaging Guide',
    tier: 'instant',
    priceUSD: 129,
    deliveryMinutes: 10,
    description: 'The checkout file includes the written voice: audience, tone, and sample lines. It is not a finished voice guide as a designed brand book.',
    inputs: [
      { key: 'brandName', label: 'Brand Name', required: true, type: 'text' },
      { key: 'audience', label: 'Target audience', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-social-media-kit',
    title: 'Instant Social Media Kit',
    tier: 'instant',
    priceUSD: 89,
    deliveryMinutes: 12,
    description: 'The checkout file includes seven text posts with a hook, a caption, and hashtags. It is not thirty finished posts or image files.',
    inputs: [
      { key: 'brand', label: 'Brand / Company', required: true, type: 'text' },
      { key: 'channels', label: 'Primary channels', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-email-sequence',
    title: 'Instant Email Onboarding Sequence',
    tier: 'instant',
    priceUSD: 119,
    deliveryMinutes: 12,
    description: 'The file is five emails with a subject, preview, body, send timing, and a call to action, written from your brief. A provider key can replace that copy.',
    inputs: [
      { key: 'product', label: 'Product description', required: true, type: 'textarea' },
      { key: 'goal', label: 'Primary goal (activation, upsell, retention…)', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-product-naming',
    title: 'Instant Product Naming Sprint',
    tier: 'instant',
    priceUSD: 59,
    deliveryMinutes: 8,
    description: 'The checkout file includes eight name candidates, a positioning line, and taglines. It does not check whether a domain is available.',
    inputs: [
      { key: 'concept', label: 'Concept (1 paragraph)', required: true, type: 'textarea' },
      { key: 'tlds', label: 'Preferred TLDs', required: false, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-resume-makeover',
    title: 'Instant Resume + LinkedIn Makeover',
    tier: 'instant',
    priceUSD: 39,
    deliveryMinutes: 10,
    description: 'The file is a Markdown resume plus a LinkedIn headline and About section, written from the resume text you supply. It does not invent an employer. A provider key can replace that copy. It is not a Word file and it has no photo.',
    inputs: [
      { key: 'currentResume', label: 'Current resume text', required: true, type: 'textarea' },
      { key: 'targetRole', label: 'Target role / industry', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },

  // ---------- PROFESSIONAL (8) — the kickoff file is the delivery ----------
  // The listed price buys that file. A running product is not in it.
  {
    id: 'professional-saas-mvp',
    title: 'SaaS MVP Kickoff File',
    tier: 'professional',
    priceUSD: 1999,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include a running SaaS, auth, billing, or a deploy.',
    inputs: [
      { key: 'spec', label: 'Product Spec', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-agent',
    title: 'Custom AI Agent Kickoff File',
    tier: 'professional',
    priceUSD: 2999,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include tools, memory, a hosted UI, or a knowledge base.',
    inputs: [
      { key: 'useCase', label: 'Use Case', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-mobile-app',
    title: 'Mobile App Kickoff File',
    tier: 'professional',
    priceUSD: 4499,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include a React Native app, push, or store-ready builds.',
    inputs: [
      { key: 'spec', label: 'App spec / wireframe', required: true, type: 'textarea' },
      { key: 'platforms', label: 'Platforms (iOS, Android, both)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ecommerce-store',
    title: 'E-commerce Store Kickoff File',
    tier: 'professional',
    priceUSD: 2499,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include a production storefront, payments, shipping, tax, or a product import.',
    inputs: [
      { key: 'brand', label: 'Brand / Niche', required: true, type: 'text' },
      { key: 'platform', label: 'Preferred platform (Shopify, WooCommerce, custom)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-chatbot',
    title: 'RAG Chatbot Kickoff File',
    tier: 'professional',
    priceUSD: 1499,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include a retrieval chatbot, a site widget, or analytics.',
    inputs: [
      { key: 'docsUrl', label: 'Docs URL / corpus location', required: true, type: 'url' },
      { key: 'goals', label: 'Use-case goals', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-data-pipeline',
    title: 'Data Pipeline Kickoff File',
    tier: 'professional',
    priceUSD: 3499,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include an ETL pipeline, a warehouse, or a KPI dashboard.',
    inputs: [
      { key: 'sources', label: 'Data sources (e.g. Stripe, Postgres, GA)', required: true, type: 'textarea' },
      { key: 'kpis', label: 'KPIs to track', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-marketing',
    title: 'Marketing Engine Kickoff File',
    tier: 'professional',
    priceUSD: 1799,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include a calendar, automation, lead capture, or an attribution dashboard.',
    inputs: [
      { key: 'product', label: 'Product / Offer', required: true, type: 'textarea' },
      { key: 'audience', label: 'Target audience', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-investor-package',
    title: 'Investor Package Kickoff File',
    tier: 'professional',
    priceUSD: 2299,
    deliveryMinutes: 5,
    requiresHumanFulfillment: true,
    description: 'The file is the project kickoff: scope from your brief, an architecture sketch, and the milestones. The price is the price of this file. The finished build is not in this file. It does not include an investor-grade deck, a financial model, or a memo.',
    inputs: [
      { key: 'company', label: 'Company / Idea (1 paragraph)', required: true, type: 'textarea' },
      { key: 'stage', label: 'Funding stage (pre-seed, seed, A…)', required: true, type: 'text' },
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
