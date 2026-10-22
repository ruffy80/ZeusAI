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

  // ---------- PROFESSIONAL (8) — BTC reserve + human-built delivery ----------
  // Honest contract: payment reserves the engagement and unlocks a signed
  // kickoff / SOW pack immediately; the finished system is delivered by the
  // ZeusAI team across the stated milestone window (not an instant download).
  {
    id: 'professional-saas-mvp',
    title: 'SaaS MVP Build Engagement (≈7 days)',
    tier: 'professional',
    priceUSD: 1999,
    deliveryDays: 7,
    requiresHumanFulfillment: true,
    description: 'Reserve with BTC: you receive a signed project kickoff pack + SOW immediately. ZeusAI engineers then build your SaaS MVP (auth, billing, deploy) across ~7 day milestones.',
    inputs: [
      { key: 'spec', label: 'Product Spec', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-agent',
    title: 'Custom AI Agent Build Engagement (≈10 days)',
    tier: 'professional',
    priceUSD: 2999,
    deliveryDays: 10,
    requiresHumanFulfillment: true,
    description: 'BTC reserve unlocks the kickoff pack now; the custom agent (tools, memory, hosted UI, your knowledge base) is delivered by the team across ~10 day milestones.',
    inputs: [
      { key: 'useCase', label: 'Use Case', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-mobile-app',
    title: 'Mobile App Build Engagement (iOS + Android, ≈14 days)',
    tier: 'professional',
    priceUSD: 4499,
    deliveryDays: 14,
    requiresHumanFulfillment: true,
    description: 'Reserve with BTC for a signed kickoff pack. Cross-platform React Native app with auth, push, and store-ready builds — delivered by the team in ~14 days.',
    inputs: [
      { key: 'spec', label: 'App spec / wireframe', required: true, type: 'textarea' },
      { key: 'platforms', label: 'Platforms (iOS, Android, both)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ecommerce-store',
    title: 'E-commerce Store Build Engagement (≈10 days)',
    tier: 'professional',
    priceUSD: 2499,
    deliveryDays: 10,
    requiresHumanFulfillment: true,
    description: 'BTC reserve + kickoff pack now; production storefront (theme, payments, shipping, tax, product import) built and handed over across ~10 day milestones.',
    inputs: [
      { key: 'brand', label: 'Brand / Niche', required: true, type: 'text' },
      { key: 'platform', label: 'Preferred platform (Shopify, WooCommerce, custom)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-chatbot',
    title: 'RAG Chatbot Build Engagement (≈7 days)',
    tier: 'professional',
    priceUSD: 1499,
    deliveryDays: 7,
    requiresHumanFulfillment: true,
    description: 'Reserve with BTC: kickoff pack immediately; retrieval-augmented chatbot on your docs, site widget + analytics delivered by the team in ~7 days.',
    inputs: [
      { key: 'docsUrl', label: 'Docs URL / corpus location', required: true, type: 'url' },
      { key: 'goals', label: 'Use-case goals', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-data-pipeline',
    title: 'Data Pipeline + Dashboard Engagement (≈14 days)',
    tier: 'professional',
    priceUSD: 3499,
    deliveryDays: 14,
    requiresHumanFulfillment: true,
    description: 'BTC reserve unlocks the SOW kickoff pack; ETL + warehouse + KPI dashboard delivered by the team across ~14 day milestones.',
    inputs: [
      { key: 'sources', label: 'Data sources (e.g. Stripe, Postgres, GA)', required: true, type: 'textarea' },
      { key: 'kpis', label: 'KPIs to track', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-marketing',
    title: '90-day Marketing Engine Engagement (≈7 days setup)',
    tier: 'professional',
    priceUSD: 1799,
    deliveryDays: 7,
    requiresHumanFulfillment: true,
    description: 'Reserve with BTC for kickoff materials now; calendar, automation, lead capture and attribution dashboard configured by the team (~7 day setup, then 90-day runbook).',
    inputs: [
      { key: 'product', label: 'Product / Offer', required: true, type: 'textarea' },
      { key: 'audience', label: 'Target audience', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-investor-package',
    title: 'Investor Package Engagement (deck + model + memo)',
    tier: 'professional',
    priceUSD: 2299,
    deliveryDays: 10,
    requiresHumanFulfillment: true,
    description: 'BTC reserve + kickoff pack immediately; investor-grade deck, financial model and memo produced by the team across ~10 day milestones.',
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
