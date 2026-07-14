'use strict';

// ===========================================================================
// fulfillment-engine.js — REAL AI-backed delivery for purchased services.
//
// The delivery-registry produces the paperwork (license, receipt, workspace
// ids). This engine produces the ACTUAL DELIVERABLE the customer paid for by
// calling the real multi-provider LLM layer (backend/modules/aiProviders) with
// a per-service "recipe", then attaches the generated artifact(s) to the
// delivery record for download.
//
// SAFETY / ROLLOUT:
//   * Feature-flagged OFF by default — only runs when FULFILLMENT_AI_ENABLED=1.
//     With the flag off, delivery behaves exactly as before (zero change to the
//     live money path).
//   * Needs at least one configured AI provider key (OPENAI_API_KEY,
//     DEEPSEEK_API_KEY, GROQ_API_KEY, …). Without a key, aiProviders.chat()
//     returns null and we mark the delivery `pending_ai_key` (no crash, no
//     false "delivered" artifact).
//   * Never throws to the caller; every failure is captured per-service.
//
// Recipes are keyword-matched over the serviceId so ONE recipe covers many
// catalog items; anything unmatched still gets a real, AI-written consulting
// brief (generic fallback) — so every paid service yields a real artifact.
// ===========================================================================

let aiProviders = null;
try { aiProviders = require('../../../backend/modules/aiProviders'); } catch (e) {
  try { aiProviders = require('../../backend/modules/aiProviders'); } catch (_) { aiProviders = null; }
}
let deliveryRegistry = null;
try { deliveryRegistry = require('./delivery-registry'); } catch (_) { deliveryRegistry = null; }

const MAX_ARTIFACT_CHARS = Number(process.env.FULFILLMENT_MAX_CHARS || 24000);

function h(str) { return String(str || '').toLowerCase(); }

// Each recipe: how to detect it, what to produce, and the prompt to the model.
const RECIPES = [
  {
    id: 'seo-content-pack', format: 'markdown',
    match: (s) => /seo|content|article|blog|copywrit/.test(s),
    title: 'SEO Content Pack',
    system: 'You are a senior SEO strategist and copywriter. Produce publish-ready, original, non-plagiarized content with clear structure.',
    prompt: (ctx) => `Create a complete SEO content pack for the customer described below.\nProduce: (1) 5 primary + 10 long-tail keywords, (2) a title + meta description, (3) a 900-1200 word SEO-optimized article in Markdown with H2/H3 headings, (4) 3 internal-link anchor suggestions.\nCustomer context: ${ctx}.`
  },
  {
    id: 'landing-page', format: 'html',
    match: (s) => /landing|website|site|page|funnel/.test(s),
    title: 'Landing Page (ready-to-ship HTML)',
    system: 'You are an expert conversion copywriter and front-end developer. Output a single self-contained, responsive HTML file with inline CSS. No external assets.',
    prompt: (ctx) => `Build a complete, self-contained responsive landing page (single HTML file, inline <style>, semantic, accessible, fast) for the offer below. Include hero, benefits, social-proof placeholder, FAQ and a clear CTA. Output ONLY the HTML.\nOffer context: ${ctx}.`
  },
  {
    id: 'brand-kit', format: 'markdown',
    match: (s) => /brand|logo|naming|name|identity|voice/.test(s),
    title: 'Brand & Naming Kit',
    system: 'You are a world-class brand strategist.',
    prompt: (ctx) => `Produce a brand kit: 8 candidate names (with rationale + domain hint), positioning statement, tagline options (5), brand voice guidelines, and a color+typography direction. Context: ${ctx}.`
  },
  {
    id: 'pitch-deck', format: 'markdown',
    match: (s) => /pitch|deck|investor|fundrais/.test(s),
    title: 'Investor Pitch Deck (outline + copy)',
    system: 'You are a top startup pitch coach who has helped raise venture rounds.',
    prompt: (ctx) => `Write a 12-slide investor pitch deck as Markdown (one section per slide: Problem, Solution, Market, Product, Business Model, Traction, GTM, Competition, Team, Financials, Ask, Vision). Include speaker notes per slide. Context: ${ctx}.`
  },
  {
    id: 'email-sequence', format: 'markdown',
    match: (s) => /email|sequence|nurtur|drip|newsletter/.test(s),
    title: 'Email Sequence',
    system: 'You are a lifecycle-marketing expert.',
    prompt: (ctx) => `Write a 5-email onboarding/nurture sequence (subject + preview + body each), with send-timing recommendations and one clear CTA per email. Context: ${ctx}.`
  },
  {
    id: 'social-kit', format: 'markdown',
    match: (s) => /social|viral|instagram|linkedin|tiktok|twitter|content-kit/.test(s),
    title: 'Social Media Kit',
    system: 'You are a viral social-media strategist.',
    prompt: (ctx) => `Produce a 2-week social content calendar: 14 posts across LinkedIn/X/Instagram with hooks, captions, hashtags and a weekly theme. Context: ${ctx}.`
  },
  {
    id: 'resume', format: 'markdown',
    match: (s) => /resume|cv|linkedin-makeover|career/.test(s),
    title: 'Resume + LinkedIn Makeover',
    system: 'You are an expert technical recruiter and resume writer.',
    prompt: (ctx) => `Produce an ATS-optimized resume (Markdown) plus a rewritten LinkedIn headline + About section, tailored to the context. Context: ${ctx}.`
  },
  {
    id: 'code-scaffold', format: 'markdown',
    match: (s) => /mvp|saas|app|chatbot|api|pipeline|agent|automation|integration/.test(s),
    title: 'Technical Build Blueprint + Starter Code',
    system: 'You are a principal software engineer. Produce a concrete, buildable blueprint with real starter code, not vague advice.',
    prompt: (ctx) => `Produce: (1) a recommended architecture, (2) a tech-stack with justification, (3) a step-by-step build plan, (4) runnable starter code for the core module (with file paths in fenced code blocks), (5) a deployment checklist. Be concrete and buildable. Context: ${ctx}.`
  },
  {
    id: 'ad-copy', format: 'markdown',
    match: (s) => /ad|ads|ppc|google-ads|meta-ads|campaign/.test(s),
    title: 'Ad Campaign Copy',
    system: 'You are a direct-response performance-marketing expert.',
    prompt: (ctx) => `Write ad copy for Google + Meta: 5 headlines, 5 descriptions, 3 primary texts, audience targeting suggestions, and a testing plan. Context: ${ctx}.`
  },
  {
    id: 'product-desc', format: 'markdown',
    match: (s) => /dropship|product|ecommerce|store|listing|shopify/.test(s),
    title: 'Product Listings + Store Copy',
    system: 'You are an e-commerce conversion copywriter.',
    prompt: (ctx) => `Write a high-converting product listing (title, bullets, long description, SEO tags) plus 3 upsell ideas and a returns/FAQ blurb. Context: ${ctx}.`
  }
];

// Generic fallback so EVERY paid service yields a real, useful artifact.
const GENERIC_RECIPE = {
  id: 'consulting-brief', format: 'markdown',
  title: 'Autonomous Consulting Brief & Action Plan',
  system: 'You are a McKinsey-grade strategy consultant with deep technical fluency.',
  prompt: (ctx) => `Produce a concrete, tailored action plan for delivering the purchased service below: objectives, a step-by-step execution plan, deliverable templates the customer can use immediately, KPIs, risks, and a 30-day timeline. Be specific and immediately usable. Context: ${ctx}.`
};

function pickRecipe(serviceId) {
  const s = h(serviceId);
  return RECIPES.find(r => r.match(s)) || GENERIC_RECIPE;
}

function contextFor(receipt, serviceId) {
  const parts = [`service="${serviceId}"`];
  if (receipt && receipt.email) parts.push(`customer="${receipt.email}"`);
  if (receipt && receipt.plan) parts.push(`plan="${receipt.plan}"`);
  if (receipt && receipt.meta && receipt.meta.brief) parts.push(`brief="${String(receipt.meta.brief).slice(0, 800)}"`);
  return parts.join(', ');
}

function extension(format) {
  return format === 'html' ? 'html' : format === 'json' ? 'json' : 'md';
}

// Produce a real artifact for one service via the LLM layer. Returns an
// artifact object or a { pending } marker; never throws.
async function fulfillService(receipt, serviceId) {
  const recipe = pickRecipe(serviceId);
  if (!aiProviders || typeof aiProviders.chat !== 'function') {
    return { serviceId, recipe: recipe.id, status: 'pending_ai_layer', title: recipe.title };
  }
  try {
    const result = await aiProviders.chat(recipe.prompt(contextFor(receipt, serviceId)), [], { });
    const reply = result && result.reply ? String(result.reply) : '';
    if (!reply) {
      return { serviceId, recipe: recipe.id, status: 'pending_ai_key', title: recipe.title };
    }
    const content = reply.slice(0, MAX_ARTIFACT_CHARS);
    return {
      serviceId,
      recipe: recipe.id,
      title: recipe.title,
      status: 'delivered',
      format: recipe.format,
      filename: `${serviceId}-${recipe.id}.${extension(recipe.format)}`,
      generatedBy: (result && (result.provider || result.model)) || 'ai',
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
      createdAt: new Date().toISOString()
    };
  } catch (e) {
    return { serviceId, recipe: recipe.id, status: 'error', title: recipe.title, error: String(e && e.message || e) };
  }
}

function serviceIds(receipt) {
  const ids = [];
  if (Array.isArray(receipt.services)) ids.push(...receipt.services);
  if (receipt.plan) ids.push(receipt.plan);
  if (receipt.serviceId) ids.push(receipt.serviceId);
  const clean = ids.map(x => String(x || '').trim()).filter(Boolean);
  return [...new Set(clean.length ? clean : ['starter'])];
}

// Generate real deliverables for every service on the receipt and attach them
// to the delivery record. Returns a summary; never throws.
async function fulfillReceipt(receipt, opts = {}) {
  if (process.env.FULFILLMENT_AI_ENABLED !== '1' && !opts.force) {
    return { ok: false, skipped: 'disabled', hint: 'set FULFILLMENT_AI_ENABLED=1 and configure an AI provider key' };
  }
  if (!receipt || !receipt.id) return { ok: false, error: 'receipt_required' };

  const ids = serviceIds(receipt);
  const artifacts = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    artifacts.push(await fulfillService(receipt, id));
  }
  const delivered = artifacts.filter(a => a.status === 'delivered').length;
  const fulfillmentStatus = delivered === artifacts.length && delivered > 0
    ? 'ai_delivered'
    : delivered > 0 ? 'ai_partial'
      : (artifacts.some(a => a.status === 'pending_ai_key' || a.status === 'pending_ai_layer') ? 'pending_ai_key' : 'error');

  if (deliveryRegistry && typeof deliveryRegistry.attachArtifacts === 'function') {
    try { deliveryRegistry.attachArtifacts(receipt.id, artifacts, fulfillmentStatus); } catch (_) { /* non-fatal */ }
  }
  return { ok: true, receiptId: receipt.id, fulfillmentStatus, delivered, total: artifacts.length, artifacts };
}

module.exports = { fulfillReceipt, fulfillService, pickRecipe, RECIPES, GENERIC_RECIPE };
