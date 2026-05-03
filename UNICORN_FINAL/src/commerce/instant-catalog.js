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
    id: 'instant-seo-content-pack',
    title: 'Instant SEO Content Pack (10 articles)',
    tier: 'instant',
    priceUSD: 79,
    deliveryMinutes: 12,
    description: 'Ten SEO-optimised long-form articles (1,500+ words each) on the topics you choose, ready to publish.',
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
    description: 'Conversion-optimised single-page site (responsive HTML/CSS) with hero, features, FAQ, CTA — yours to host anywhere.',
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
    description: 'Tone-of-voice guide, key messages, taglines, do/don\'t list — calibrated to your audience and competitors.',
    inputs: [
      { key: 'brandName', label: 'Brand Name', required: true, type: 'text' },
      { key: 'audience', label: 'Target audience', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-social-media-kit',
    title: 'Instant Social Media Kit (30 posts)',
    tier: 'instant',
    priceUSD: 89,
    deliveryMinutes: 12,
    description: 'Thirty channel-ready social posts (Twitter/X, LinkedIn, Instagram) with hooks, copy and image briefs for one month.',
    inputs: [
      { key: 'brand', label: 'Brand / Company', required: true, type: 'text' },
      { key: 'channels', label: 'Primary channels', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-email-sequence',
    title: 'Instant 7-Email Onboarding Sequence',
    tier: 'instant',
    priceUSD: 119,
    deliveryMinutes: 12,
    description: 'Seven-step lifecycle email sequence (welcome → activation → upgrade) tailored to your product and tone.',
    inputs: [
      { key: 'product', label: 'Product description', required: true, type: 'textarea' },
      { key: 'goal', label: 'Primary goal (activation, upsell, retention…)', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'instant-product-naming',
    title: 'Instant Product Naming Sprint (25 names + domains)',
    tier: 'instant',
    priceUSD: 59,
    deliveryMinutes: 8,
    description: '25 brandable name candidates with available .com / .ai / .io domains shortlisted, plus rationale for each.',
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
    description: 'AI-rewritten one-page resume + matching LinkedIn About / headline tuned to your target role.',
    inputs: [
      { key: 'currentResume', label: 'Current resume text', required: true, type: 'textarea' },
      { key: 'targetRole', label: 'Target role / industry', required: true, type: 'text' },
      { key: 'email', label: 'Delivery Email', required: true, type: 'email' }
    ]
  },

  // ---------- PROFESSIONAL (8) — hand-built, days–weeks ----------
  {
    id: 'professional-saas-mvp',
    title: 'Professional SaaS MVP (1-week build)',
    tier: 'professional',
    priceUSD: 1999,
    deliveryDays: 7,
    description: 'Hand-built SaaS MVP with auth, billing, deployment to your domain on a managed cloud.',
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
    description: 'Custom AI agent with tool-calling, memory and a hosted UI — trained on your knowledge base and deployed to your domain.',
    inputs: [
      { key: 'useCase', label: 'Use Case', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-mobile-app',
    title: 'Professional Mobile App (iOS + Android, 14 days)',
    tier: 'professional',
    priceUSD: 4499,
    deliveryDays: 14,
    description: 'Cross-platform mobile app (React Native) with auth, push notifications and store-ready builds for iOS and Android.',
    inputs: [
      { key: 'spec', label: 'App spec / wireframe', required: true, type: 'textarea' },
      { key: 'platforms', label: 'Platforms (iOS, Android, both)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ecommerce-store',
    title: 'Professional E-commerce Store (Shopify/Stripe-ready)',
    tier: 'professional',
    priceUSD: 2499,
    deliveryDays: 10,
    description: 'Production-ready storefront with custom theme, payment, shipping, tax and a 30-product import — yours to operate.',
    inputs: [
      { key: 'brand', label: 'Brand / Niche', required: true, type: 'text' },
      { key: 'platform', label: 'Preferred platform (Shopify, WooCommerce, custom)', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-chatbot',
    title: 'Professional AI Chatbot (RAG on your docs)',
    tier: 'professional',
    priceUSD: 1499,
    deliveryDays: 7,
    description: 'Retrieval-augmented chatbot trained on your documentation, deployed as a widget on your site with analytics.',
    inputs: [
      { key: 'docsUrl', label: 'Docs URL / corpus location', required: true, type: 'url' },
      { key: 'goals', label: 'Use-case goals', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-data-pipeline',
    title: 'Professional Data Pipeline + Analytics Dashboard',
    tier: 'professional',
    priceUSD: 3499,
    deliveryDays: 14,
    description: 'End-to-end ETL with a metrics warehouse (Postgres/BigQuery) and a Metabase/Looker-style dashboard for KPIs.',
    inputs: [
      { key: 'sources', label: 'Data sources (e.g. Stripe, Postgres, GA)', required: true, type: 'textarea' },
      { key: 'kpis', label: 'KPIs to track', required: true, type: 'textarea' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-ai-marketing',
    title: 'Professional 90-day Automated Marketing Engine',
    tier: 'professional',
    priceUSD: 1799,
    deliveryDays: 7,
    description: 'AI-driven marketing engine for 90 days: content calendar, automated posting, lead capture, attribution dashboard.',
    inputs: [
      { key: 'product', label: 'Product / Offer', required: true, type: 'textarea' },
      { key: 'audience', label: 'Target audience', required: true, type: 'text' },
      { key: 'email', label: 'Project Email', required: true, type: 'email' }
    ]
  },
  {
    id: 'professional-investor-package',
    title: 'Professional Investor Package (deck + financials + memo)',
    tier: 'professional',
    priceUSD: 2299,
    deliveryDays: 10,
    description: 'Investor-grade pitch deck, 5-year financial model, one-page memo and a curated warm-intro list of 50+ investors.',
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
