// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T17:30:31.135Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.MONEY_MACHINE_DATA_DIR || path.join(APP_DIR, 'data', 'money-machine');
const EVENTS_FILE = path.join(DATA_DIR, 'conversion-events.jsonl');
const LEADS_FILE = path.join(DATA_DIR, 'sales-leads.jsonl');
const RECOVERY_FILE = path.join(DATA_DIR, 'checkout-recovery.jsonl');
const OFFERS_FILE = path.join(DATA_DIR, 'offers.jsonl');

fs.mkdirSync(DATA_DIR, { recursive: true });

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
const hash = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function readJsonl(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (_) {
    return [];
  }
}

function appendJsonl(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
  return entry;
}

const baseProducts = [
  { id: 'ai-sales-kit', title: 'AI Sales Kit', priceUsd: 299, target: 'B2B founders', modules: ['AI SDR', 'Sales Closer', 'Proposal Generator'], promise: 'more qualified calls and faster close cycles' },
  { id: 'autonomous-website-pack', title: 'Autonomous Website Pack', priceUsd: 499, target: 'service businesses', modules: ['Programmatic SEO', 'Conversion Intelligence', 'Checkout Recovery'], promise: 'site that tests, sells and recovers revenue automatically' },
  { id: 'compliance-trust-pack', title: 'Compliance Trust Pack', priceUsd: 799, target: 'enterprise SaaS', modules: ['Trust Center', 'DPA', 'Transparency Ledger', 'Privacy Export'], promise: 'enterprise-ready trust evidence without months of manual work' },
  { id: 'money-machine-pro', title: 'Money Machine Pro', priceUsd: 1499, target: 'growth teams', modules: ['Revenue Commander', 'Offer Factory', 'Customer Success Autopilot', 'Profit Dashboard'], promise: 'autonomous growth loop from traffic to retention' },
];

function offerFactory(input = {}) {
  const industry = String(input.industry || 'global SaaS').slice(0, 80);
  const segment = String(input.segment || 'B2B').slice(0, 80);
  const budget = Number(input.budgetUsd || 0);
  const generated = baseProducts.map((product, index) => ({
    ...product,
    id: `${product.id}-${hash(`${industry}:${segment}:${product.id}`).slice(0, 6)}`,
    industry,
    segment,
    priceUsd: budget > 0 ? Math.max(product.priceUsd, Math.round(budget * (0.18 + index * 0.07))) : product.priceUsd,
    checkoutPath: `/checkout?plan=${encodeURIComponent(product.id)}`,
    roiAngle: `${product.promise} for ${industry}`,
    createdAt: now(),
  }));
  generated.forEach((offer) => appendJsonl(OFFERS_FILE, offer));
  return { ok: true, generatedAt: now(), offers: generated, count: generated.length };
}

function revenueCommander() {
  const events = readJsonl(EVENTS_FILE);
  const leads = readJsonl(LEADS_FILE);
  const recoveries = readJsonl(RECOVERY_FILE);
  const offers = readJsonl(OFFERS_FILE).slice(-20);
  const checkoutEvents = events.filter((event) => event.type === 'checkout_started').length;
  const paidEvents = events.filter((event) => event.type === 'payment_confirmed').length;
  const conversionRate = checkoutEvents ? Number(((paidEvents / checkoutEvents) * 100).toFixed(2)) : 0;
  const topOffer = offers[offers.length - 1] || baseProducts[0];
  const actions = [
    { priority: 1, action: 'promote_offer', offerId: topOffer.id, channel: 'homepage-pricing-checkout', expectedImpact: 'increase qualified checkout starts' },
    { priority: 2, action: 'recover_abandoned_checkouts', count: recoveries.filter((item) => item.status === 'queued').length, expectedImpact: 'capture missed BTC invoices' },
    { priority: 3, action: 'enrich_and_contact_leads', count: leads.filter((lead) => lead.status === 'qualified').length, expectedImpact: 'create B2B pipeline' },
    { priority: 4, action: 'publish_programmatic_seo_pages', count: 12, expectedImpact: 'compound organic traffic' },
  ];
  return {
    ok: true,
    mode: 'autonomous-profit-foundation',
    generatedAt: now(),
    kpis: { events: events.length, leads: leads.length, recoveries: recoveries.length, offers: offers.length, checkoutEvents, paidEvents, conversionRate },
    decision: { focus: conversionRate < 5 ? 'checkout-and-offer-optimization' : 'scale-traffic-and-upsell', topOffer: topOffer.id || topOffer.title, actions },
    guardrails: ['BTC direct remains primary rail', 'no dark patterns', 'human approval for external spend', 'transparent pricing experiments'],
  };
}

function recordConversionEvent(body = {}) {
  const event = appendJsonl(EVENTS_FILE, {
    id: id('evt'),
    type: String(body.type || 'page_view').slice(0, 80),
    path: String(body.path || '/').slice(0, 180),
    emailHash: body.email ? hash(String(body.email).toLowerCase()) : null,
    valueUsd: Number(body.valueUsd || 0),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    createdAt: now(),
  });
  return { ok: true, event };
}

function conversionIntelligence() {
  const events = readJsonl(EVENTS_FILE);
  const grouped = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  const recommendations = [
    { area: 'headline', test: 'ROI-first headline vs autonomy-first headline', metric: 'checkout_started' },
    { area: 'pricing', test: 'bundle anchor price vs module-by-module pricing', metric: 'payment_confirmed' },
    { area: 'checkout', test: 'BTC invoice proof + delivery preview above fold', metric: 'invoice_paid' },
  ];
  return { ok: true, generatedAt: now(), totals: grouped, eventCount: events.length, recommendations };
}

function queueCheckoutRecovery(body = {}) {
  const email = String(body.email || '').toLowerCase().trim();
  const recovery = appendJsonl(RECOVERY_FILE, {
    id: id('rec'),
    emailHash: email ? hash(email) : null,
    receiptId: String(body.receiptId || '').slice(0, 120),
    plan: String(body.plan || body.offerId || 'unknown').slice(0, 120),
    amountUsd: Number(body.amountUsd || 0),
    status: 'queued',
    sequence: ['instant reminder', 'ROI proof follow-up', 'final delivery preview'],
    createdAt: now(),
  });
  return { ok: true, recovery };
}

function recoveryStatus() {
  const recoveries = readJsonl(RECOVERY_FILE);
  return { ok: true, queued: recoveries.filter((item) => item.status === 'queued').length, total: recoveries.length, recent: recoveries.slice(-10).reverse() };
}

function qualifyLead(body = {}) {
  const company = String(body.company || body.domain || 'unknown').slice(0, 120);
  const industry = String(body.industry || 'SaaS').slice(0, 80);
  const pain = String(body.pain || 'growth automation').slice(0, 180);
  const employeeCount = Number(body.employeeCount || 0);
  const budgetSignal = Number(body.budgetUsd || 0);
  const score = Math.min(100, 35 + (employeeCount > 10 ? 20 : 0) + (budgetSignal > 500 ? 25 : 0) + (pain.length > 20 ? 20 : 5));
  const lead = appendJsonl(LEADS_FILE, {
    id: id('lead'),
    company,
    industry,
    pain,
    score,
    status: score >= 70 ? 'qualified' : 'nurture',
    nextAction: score >= 70 ? 'send ROI audit + book demo' : 'send educational offer',
    createdAt: now(),
  });
  return { ok: true, lead };
}

function closerAnswer(body = {}) {
  const objection = String(body.objection || body.question || 'price').toLowerCase();
  const plan = String(body.plan || 'money-machine-pro');
  const answers = {
    price: `Start with ${plan}, measure recovered revenue and upgrade only when ROI is visible. BTC direct checkout is available now.`,
    trust: 'Every receipt, delivery, passkey identity and transparency event is verifiable through public APIs and append-only logs.',
    implementation: 'The platform is delivered as a live SaaS/API layer; onboarding focuses on your offer, traffic source and first revenue loop.',
    security: 'Stable runtime, durable SQLite, passkeys, secret auto-bootstrap, CSP, rate limits and guardian monitoring are already active.',
  };
  const key = Object.keys(answers).find((item) => objection.includes(item)) || 'implementation';
  return { ok: true, plan, objection: key, answer: answers[key], cta: `/checkout?plan=${encodeURIComponent(plan)}` };
}

function programmaticSeoStatus() {
  const verticals = ['fintech', 'ecommerce', 'legaltech', 'healthtech', 'manufacturing', 'real-estate', 'education', 'agritech', 'cybersecurity', 'hospitality', 'logistics', 'creator-economy'];
  return {
    ok: true,
    status: 'foundation-live',
    pageTemplates: verticals.length,
    verticals,
    nextPages: verticals.map((vertical) => ({ slug: `/use-cases/${vertical}-autonomous-saas`, title: `Autonomous SaaS money machine for ${vertical}` })),
  };
}

function generateSeoPages(body = {}) {
  const verticals = Array.isArray(body.verticals) && body.verticals.length ? body.verticals : programmaticSeoStatus().verticals.slice(0, 5);
  return { ok: true, generatedAt: now(), pages: verticals.slice(0, 50).map((vertical) => ({ slug: `/use-cases/${String(vertical).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ai-saas`, keyword: `${vertical} AI SaaS automation`, intent: 'high-commercial', cta: '/checkout' })) };
}

function customerSuccessStatus() {
  return {
    ok: true,
    status: 'foundation-live',
    playbooks: ['trial activation', 'first value moment', 'usage-based upsell', 'churn rescue', 'enterprise expansion'],
    healthSignals: ['last login', 'receipt paid', 'license downloaded', 'api usage', 'support friction', 'module activation'],
  };
}

function analyzeCustomer(body = {}) {
  const usage = Number(body.usage || body.apiCalls || 0);
  const paid = Boolean(body.paid || body.receiptPaid);
  const daysInactive = Number(body.daysInactive || 0);
  const healthScore = Math.max(0, Math.min(100, 50 + (paid ? 20 : -10) + Math.min(20, usage / 50) - Math.min(35, daysInactive * 5)));
  const action = healthScore < 45 ? 'churn-rescue' : healthScore > 75 ? 'upsell-expansion' : 'activation-nurture';
  return { ok: true, healthScore: Math.round(healthScore), action, nextSteps: action === 'upsell-expansion' ? ['offer annual plan', 'recommend adjacent module'] : ['send onboarding proof', 'schedule AI concierge follow-up'] };
}

function status() {
  return {
    ok: true,
    status: 'foundation-live',
    modules: ['Autonomous Revenue Commander', 'Offer Factory', 'Conversion Intelligence Layer', 'Checkout Recovery Agent', 'AI SDR Agent', 'AI Sales Closer Pro', 'Programmatic SEO Engine', 'Customer Success Autopilot'],
    revenueCommander: revenueCommander().decision,
    conversion: conversionIntelligence(),
    recovery: recoveryStatus(),
    seo: programmaticSeoStatus(),
    customerSuccess: customerSuccessStatus(),
  };
}

module.exports = {
  status,
  revenueCommander,
  offerFactory,
  recordConversionEvent,
  conversionIntelligence,
  queueCheckoutRecovery,
  recoveryStatus,
  qualifyLead,
  closerAnswer,
  programmaticSeoStatus,
  generateSeoPages,
  customerSuccessStatus,
  analyzeCustomer,
};