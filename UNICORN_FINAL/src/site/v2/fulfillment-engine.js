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
// SAFETY / ROLLOUT (Fulfillment AI Eternal OS):
//   * FULFILLMENT_AI_ENABLED=auto (default): armed when ≥1 real LLM key exists
//     in process env or sanctum planes (.env / shared /etc/zeusai/secrets).
//     `1`/`true` force-on (still needs a key at call time); `0`/`off` force-off.
//   * Needs at least one configured AI provider key (OPENAI_API_KEY,
//     DEEPSEEK_API_KEY, GROQ_API_KEY, …). Without a key, we ship a deterministic
//     activation pack (no crash, no false "AI delivered" artifact).
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
let fulfillmentAiOs = null;
try { fulfillmentAiOs = require('../../../backend/modules/fulfillment-ai-os'); } catch (e) {
  try { fulfillmentAiOs = require('../../backend/modules/fulfillment-ai-os'); } catch (_) { fulfillmentAiOs = null; }
}
let deliveryRegistry = null;
try { deliveryRegistry = require('./delivery-registry'); } catch (_) { deliveryRegistry = null; }

const MAX_ARTIFACT_CHARS = Number(process.env.FULFILLMENT_MAX_CHARS || 24000);
// High-ticket / enterprise services (>= this USD, or matched by id) are NOT
// auto-"delivered" as a finished product — that would be fraud. Instead the
// engine instantly delivers a real, closable ENGAGEMENT PROPOSAL and flags the
// order for milestone-based human-led execution.
const ENTERPRISE_THRESHOLD_USD = Number(process.env.FULFILLMENT_ENTERPRISE_USD || 5000);
const ENTERPRISE_ID_RE = /sovereign|private[-_]?(deployment|cloud)|platform[-_]?license|acquisition|white[-_]?label|franchise|revenue[-_]?share|enterprise|\bent-|transformation|not-yet-invented/;
const PROFESSIONAL_ID_RE = /^professional-/;

// Exact SKU → recipe id (wins over keyword matching so website-audit ≠ landing-page).
const SKU_RECIPES = {
  'instant-website-audit': 'website-audit',
  'instant-logo-kit': 'brand-kit',
  'instant-pitch-deck': 'pitch-deck',
  'instant-seo-content-pack': 'seo-content-pack',
  'instant-landing-page': 'landing-page',
  'instant-brand-voice': 'brand-kit',
  'instant-social-media-kit': 'social-kit',
  'instant-email-sequence': 'email-sequence',
  'instant-product-naming': 'brand-kit',
  'instant-resume-makeover': 'resume',
  'professional-saas-mvp': 'code-scaffold',
  'professional-ai-agent': 'code-scaffold',
  'professional-mobile-app': 'code-scaffold',
  'professional-ecommerce-store': 'product-desc',
  'professional-ai-chatbot': 'code-scaffold',
  'professional-data-pipeline': 'code-scaffold',
  'professional-ai-marketing': 'social-kit',
  'professional-investor-package': 'pitch-deck',
};

function h(str) { return String(str || '').toLowerCase(); }

function receiptAmountUsd(receipt) {
  const cands = [receipt && receipt.amount, receipt && receipt.amountUsd, receipt && receipt.amount_usd, receipt && receipt.subtotal_fiat, receipt && receipt.unit_price_full_fiat];
  for (const c of cands) { const n = Number(c); if (Number.isFinite(n) && n > 0) return n; }
  return 0;
}

function isEnterprise(receipt, serviceId) {
  if (ENTERPRISE_ID_RE.test(h(serviceId))) return true;
  return receiptAmountUsd(receipt) >= ENTERPRISE_THRESHOLD_USD;
}

function needsHumanFulfillment(receipt, serviceId) {
  if (isEnterprise(receipt, serviceId)) return true;
  const sid = h(serviceId);
  if (PROFESSIONAL_ID_RE.test(sid)) return true;
  if (receipt && receipt.meta && receipt.meta.requiresHumanFulfillment === true) return true;
  if (receipt && receipt.buy_mode === 'reserve') return true;
  return false;
}

// Each recipe: how to detect it, what to produce, and the prompt to the model.
const RECIPES = [
  {
    id: 'website-audit', format: 'markdown',
    match: (s) => /website-audit|site-audit|seo-audit|perf-audit/.test(s),
    title: 'Website Audit (SEO + Performance + Accessibility)',
    system: 'You are a senior web performance, SEO and accessibility auditor. Produce a concrete, prioritized audit with evidence-style findings — not a landing page.',
    prompt: (ctx) => `Produce a full website audit in Markdown for the URL/context below. Include: (1) executive summary scorecard, (2) SEO findings (title/meta/headings/indexation/schema), (3) performance findings (CWV, assets, caching), (4) accessibility (WCAG 2.2 AA quick pass), (5) security/headers checklist, (6) prioritized 30-day fix plan with owner/effort. Context: ${ctx}.`
  },
  {
    id: 'seo-content-pack', format: 'markdown',
    match: (s) => /seo-content|seo_content|content-pack|article|blog|copywrit/.test(s) && !/audit/.test(s),
    title: 'SEO Content Pack',
    system: 'You are a senior SEO strategist and copywriter. Produce publish-ready, original, non-plagiarized content with clear structure.',
    prompt: (ctx) => `Create a complete SEO content pack for the customer described below.\nProduce: (1) 5 primary + 10 long-tail keywords, (2) a title + meta description, (3) a 900-1200 word SEO-optimized article in Markdown with H2/H3 headings, (4) 3 internal-link anchor suggestions.\nCustomer context: ${ctx}.`
  },
  {
    id: 'landing-page', format: 'html',
    match: (s) => /landing-page|landing_page|funnel/.test(s) || (/landing/.test(s) && !/audit/.test(s)),
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

// High-ticket engagements deliver a real, closable proposal instantly — the
// correct deliverable for a big-ticket sale — while the product itself is
// executed as a milestone-based, human-led engagement (honest, no fake claim).
const ENTERPRISE_RECIPE = {
  id: 'enterprise-engagement', format: 'markdown',
  title: 'Enterprise Engagement Proposal & Kickoff Plan',
  system: 'You are a top enterprise solutions architect and deal lead who structures multi-million-dollar B2B engagements. Be concrete, credible, and commercially rigorous.',
  prompt: (ctx) => `Produce a complete enterprise ENGAGEMENT PROPOSAL (Markdown) for the high-value service below. This is delivered instantly to the buyer to start a milestone-based engagement (NOT a claim that the full system is already delivered). Include, with real specifics:
1. Executive summary & business outcomes
2. Solution architecture (components, data flow, security/compliance model)
3. Scope of Work broken into 4-6 delivery phases
4. Milestone payment schedule (deposit + per-milestone %, tied to explicit acceptance criteria) that sums to the contract value
5. Timeline with durations per phase
6. Security, compliance (SOC2/GDPR as relevant), SLA & support model
7. Team, governance & communication cadence
8. Risks & mitigations
9. Commercials summary + clear next steps to sign and kick off
End with a short note: "This document is your engagement proposal and kickoff plan; delivery is executed by the ZeusAI team across the milestones above." Context: ${ctx}.`
};

const PROFESSIONAL_RECIPE = {
  id: 'professional-kickoff', format: 'markdown',
  title: 'Professional Build Kickoff Pack & Milestone Plan',
  system: 'You are a principal delivery lead who scopes mid-ticket software builds honestly.',
  prompt: (ctx) => `Produce a PROFESSIONAL BUILD KICKOFF PACK (Markdown) for the paid engagement below. This is the immediate deliverable after BTC reserve — NOT a claim that the finished product is already shipped. Include:
1. Restated goals from buyer inputs
2. Scope / out-of-scope
3. Architecture sketch
4. Milestone plan with acceptance criteria
5. Risks, dependencies, and communication cadence
6. What the buyer already has (this pack + signed receipt) vs what the team will deliver next
Context: ${ctx}.`
};

function pickRecipe(serviceId) {
  const raw = String(serviceId || '').trim();
  const exact = SKU_RECIPES[raw] || SKU_RECIPES[h(raw)];
  if (exact) {
    if (exact === 'website-audit') {
      return RECIPES.find((r) => r.id === 'website-audit') || GENERIC_RECIPE;
    }
    return RECIPES.find((r) => r.id === exact) || GENERIC_RECIPE;
  }
  const s = h(serviceId);
  return RECIPES.find(r => r.match(s)) || GENERIC_RECIPE;
}

function contextFor(receipt, serviceId) {
  const parts = [`service="${serviceId}"`];
  if (receipt && receipt.email) parts.push(`customer="${receipt.email}"`);
  if (receipt && receipt.buyer && receipt.buyer.email) parts.push(`customer="${receipt.buyer.email}"`);
  if (receipt && receipt.plan) parts.push(`plan="${receipt.plan}"`);
  if (receipt && receipt.meta && receipt.meta.brief) parts.push(`brief="${String(receipt.meta.brief).slice(0, 800)}"`);
  const inputs = (receipt && receipt.meta && receipt.meta.inputs)
    || (receipt && receipt.buyer && receipt.buyer.inputs)
    || null;
  if (inputs && typeof inputs === 'object') {
    try {
      parts.push(`inputs=${JSON.stringify(inputs).slice(0, 1200)}`);
    } catch (_) { /* ignore */ }
  }
  return parts.join(', ');
}

function extension(format) {
  return format === 'html' ? 'html' : format === 'json' ? 'json' : 'md';
}

function publicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function compactLines(lines) {
  return lines.filter((line, index) => line != null && (String(line).trim() || (index > 0 && String(lines[index - 1] || '').trim())));
}

function receiptRefs(receipt) {
  return {
    orderId: firstNonEmpty([receipt && receipt.orderId, receipt && receipt.id]),
    btcAmount: firstNonEmpty([
      receipt && receipt.btcAmount,
      receipt && receipt.amount_btc,
      receipt && receipt.btcpay && receipt.btcpay.btcAmount,
      receipt && receipt.destination && receipt.destination.btcAmount
    ]),
    btcAddress: firstNonEmpty([
      receipt && receipt.btcAddress,
      receipt && receipt.destination && receipt.destination.address,
      receipt && receipt.destination && receipt.destination.btcAddress
    ]),
    btcUri: firstNonEmpty([
      receipt && receipt.btcUri,
      receipt && receipt.destination && receipt.destination.btcUri
    ]),
    btcpayInvoiceId: firstNonEmpty([
      receipt && receipt.btcpay && receipt.btcpay.invoiceId,
      receipt && receipt.btcpay && receipt.btcpay.id,
      receipt && receipt.destination && receipt.destination.invoiceId
    ]),
    btcpayCheckoutUrl: firstNonEmpty([
      receipt && receipt.btcpayCheckoutUrl,
      receipt && receipt.btcpay && receipt.btcpay.checkoutUrl,
      receipt && receipt.destination && receipt.destination.btcpayCheckoutUrl
    ]),
    txids: [...new Set([
      ...(Array.isArray(receipt && receipt.txids) ? receipt.txids : []),
      receipt && receipt.txid,
      receipt && receipt.confirmation && receipt.confirmation.txid
    ].map((txid) => String(txid || '').trim()).filter(Boolean))]
  };
}

function downloadInstructions(receipt, serviceId) {
  const base = publicAppUrl();
  const receiptId = encodeURIComponent(receipt.id);
  const encodedServiceId = encodeURIComponent(serviceId);
  return [
    `Signed receipt JSON: ${base}/api/invoice/${receiptId}`,
    `License token: ${base}/api/license/${receiptId}`,
    `Delivery overview: ${base}/api/delivery/${receiptId}`,
    `Onboarding inputs: ${base}/api/delivery/${receiptId}?format=onboarding&serviceId=${encodedServiceId}`,
    `API/workspace payload: ${base}/api/delivery/${receiptId}?serviceId=${encodedServiceId}`,
    `Fulfillment artifact list: ${base}/api/delivery/${receiptId}?format=artifacts`,
    `This activation pack: ${base}/api/delivery/${receiptId}?format=artifact&serviceId=${encodedServiceId}`
  ];
}

function buildDeterministicArtifact(receipt, serviceId, recipe, opts = {}) {
  const human = !!(opts.enterprise || opts.professional || opts.requiresHuman);
  const enterprise = !!opts.enterprise;
  const refs = receiptRefs(receipt);
  const nextSteps = human
    ? [
        'Review the engagement scope and milestone plan in this pack.',
        'Reply with the implementation owner, kickoff window, and any compliance contacts.',
        'Use the delivery overview and receipt links below for procurement and internal approval.',
        'ZeusAI follows up to schedule the milestone-based kickoff and delivery cadence.'
      ]
    : [
        'Download the signed receipt and license token from the links below.',
        'Open the onboarding payload and provide any missing business inputs.',
        'Check the fulfillment artifact endpoint for the SKU-specific deliverable (or regenerated AI pack when enabled).',
        'If this pack is a deterministic fallback, treat it as your activation record — full AI generation runs when Fulfillment AI Eternal OS is armed (FULFILLMENT_AI_ENABLED=auto|1 + a real provider key).'
      ];
  const track = enterprise
    ? 'Track: enterprise engagement kickoff (milestone-based human fulfillment follows).'
    : (opts.professional
      ? 'Track: professional build kickoff (human fulfillment follows across stated milestones).'
      : 'Track: digital activation pack (deterministic fallback because AI fulfillment was unavailable or disabled).');
  const content = compactLines([
    human ? '# Project Kickoff Pack' : '# Service Activation Pack',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Fulfillment mode: deterministic`,
    track,
    opts.reason ? `Fallback reason: ${opts.reason}` : '',
    '',
    '## Order Summary',
    `- Order ID: ${refs.orderId || 'unknown'}`,
    `- Service ID: ${serviceId}`,
    `- Service Name: ${receipt && (receipt.serviceName || receipt.plan) ? (receipt.serviceName || receipt.plan) : recipe.title}`,
    `- Customer: ${receipt && (receipt.email || (receipt.buyer && receipt.buyer.email)) ? (receipt.email || receipt.buyer.email) : 'not provided'}`,
    `- Payment Status: ${receipt && receipt.status ? receipt.status : 'paid'}`,
    `- Price (USD): ${receiptAmountUsd(receipt) > 0 ? receiptAmountUsd(receipt).toFixed(2) : 'not recorded'}`,
    '',
    '## What Is Included',
    human
      ? `This pack is the immediate, honest deliverable for "${recipe.title}". It captures commercial kickoff, milestone coordination, and download references while the ZeusAI team executes the actual engagement. It is NOT a claim that the finished product is already shipped.`
      : `This pack is the immediate activation deliverable for "${recipe.title}". It gives the buyer concrete next steps, receipt references, and download locations. When AI fulfillment is enabled, a SKU-specific generated artifact replaces or supplements this pack.`,
    '',
    '## Next Steps',
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## BTC Receipt References',
    `- BTC Amount: ${refs.btcAmount || 'not recorded'}`,
    `- BTC Address: ${refs.btcAddress || 'not recorded'}`,
    `- BIP21 URI: ${refs.btcUri || 'not recorded'}`,
    `- BTCPay Invoice ID: ${refs.btcpayInvoiceId || 'not recorded'}`,
    `- BTCPay Checkout URL: ${refs.btcpayCheckoutUrl || 'not recorded'}`,
    `- Transaction IDs: ${refs.txids.length ? refs.txids.join(', ') : 'not recorded yet'}`,
    '',
    '## Download Instructions',
    ...downloadInstructions(receipt, serviceId).map((line) => `- ${line}`),
    '',
    '## Delivery Notes',
    human
      ? 'This document is your kickoff / engagement pack; the underlying product is delivered by the ZeusAI team according to the agreed milestones.'
      : 'This artifact is intentionally deterministic and never claims AI generation when AI was not actually used.',
  ]).join('\n');

  return {
    serviceId,
    recipe: recipe.id,
    tier: enterprise ? 'enterprise' : (opts.professional ? 'professional' : 'standard'),
    deliverableType: enterprise ? 'enterprise-proposal' : (opts.professional ? 'project-kickoff' : 'product'),
    requiresHumanFulfillment: human,
    title: human ? 'Project Kickoff Pack' : 'Service Activation Pack',
    status: 'delivered',
    format: 'markdown',
    filename: `${serviceId}-service-activation-pack.${extension('markdown')}`,
    generatedBy: 'deterministic-engine',
    fulfillmentMode: 'deterministic',
    bytes: Buffer.byteLength(content, 'utf8'),
    content,
    createdAt: new Date().toISOString()
  };
}

// Produce a real artifact for one service via the LLM layer. Returns an
// artifact object or a { pending } marker; never throws.
function aiSkuAllowlist() {
  if (fulfillmentAiOs && typeof fulfillmentAiOs.skuAllowlist === 'function') {
    return fulfillmentAiOs.skuAllowlist();
  }
  const raw = String(process.env.FULFILLMENT_AI_SKUS || '').trim();
  if (!raw) {
    return new Set([
      'instant-website-audit',
      'instant-seo-content-pack',
      'instant-landing-page',
      'instant-pitch-deck',
      'instant-email-sequence',
    ]);
  }
  if (raw === '*' || raw.toLowerCase() === 'all') return null; // all non-human SKUs
  return new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

function shouldUseAiForSku(serviceId) {
  if (fulfillmentAiOs && typeof fulfillmentAiOs.shouldUseAiForSku === 'function') {
    return fulfillmentAiOs.shouldUseAiForSku(serviceId);
  }
  // Legacy fallback if Eternal OS module missing
  const flag = String(process.env.FULFILLMENT_AI_ENABLED || '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag !== '1' && flag !== 'true' && flag !== 'on' && flag !== 'auto' && flag !== '') return false;
  if (flag === 'auto' || flag === '') {
    // Without OS module we cannot safely probe keys — stay off.
    return false;
  }
  const allow = aiSkuAllowlist();
  if (allow == null) return true;
  return allow.has(String(serviceId || '').trim());
}

async function fulfillService(receipt, serviceId) {
  const enterprise = isEnterprise(receipt, serviceId);
  const professional = !enterprise && needsHumanFulfillment(receipt, serviceId);
  const human = enterprise || professional;
  const recipe = enterprise
    ? ENTERPRISE_RECIPE
    : (professional ? PROFESSIONAL_RECIPE : pickRecipe(serviceId));
  const tier = enterprise ? 'enterprise' : (professional ? 'professional' : 'standard');
  // High-ticket / professional stays on engagement/kickoff packs (never fake "AI delivered product").
  const shouldUseAi = !human && shouldUseAiForSku(serviceId);
  if (shouldUseAi && fulfillmentAiOs && typeof fulfillmentAiOs.reloadKeysFromSanctum === 'function') {
    try { fulfillmentAiOs.reloadKeysFromSanctum(); } catch (_) { /* non-fatal */ }
  }
  if (!shouldUseAi || !aiProviders || typeof aiProviders.chat !== 'function') {
    return buildDeterministicArtifact(receipt, serviceId, recipe, {
      enterprise,
      professional,
      requiresHuman: human,
      reason: !shouldUseAi ? 'ai_disabled' : 'ai_layer_unavailable'
    });
  }
  try {
    const result = await aiProviders.chat(recipe.prompt(contextFor(receipt, serviceId)), [], human ? { premiumOnly: false } : {});
    const reply = result && result.reply ? String(result.reply) : '';
    if (!reply) {
      return buildDeterministicArtifact(receipt, serviceId, recipe, {
        enterprise,
        professional,
        requiresHuman: human,
        reason: 'ai_null_response'
      });
    }
    const content = reply.slice(0, MAX_ARTIFACT_CHARS);
    return {
      serviceId,
      recipe: recipe.id,
      tier,
      // Human-led engagements: the KICKOFF/PROPOSAL is delivered now; the
      // finished product is executed as a milestone-based engagement.
      deliverableType: enterprise ? 'enterprise-proposal' : (professional ? 'project-kickoff' : 'product'),
      requiresHumanFulfillment: human,
      title: recipe.title,
      status: 'delivered',
      format: recipe.format,
      filename: `${serviceId}-${recipe.id}.${extension(recipe.format)}`,
      generatedBy: (result && (result.provider || result.model)) || 'ai',
      fulfillmentMode: 'ai',
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
      createdAt: new Date().toISOString()
    };
  } catch (e) {
    return buildDeterministicArtifact(receipt, serviceId, recipe, {
      enterprise,
      professional,
      requiresHuman: human,
      reason: 'ai_error:' + String(e && e.message || e)
    });
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
  if (!receipt || !receipt.id) return { ok: false, error: 'receipt_required' };

  const ids = serviceIds(receipt);
  const artifacts = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    artifacts.push(await fulfillService(receipt, id));
  }
  const delivered = artifacts.filter(a => a.status === 'delivered').length;
  const fulfillmentStatus = delivered > 0 && artifacts.every(a => a.fulfillmentMode === 'ai')
    ? 'ai'
    : 'deterministic';

  const requiresHumanFulfillment = artifacts.some(a => a.requiresHumanFulfillment);
  if (deliveryRegistry && typeof deliveryRegistry.attachArtifacts === 'function') {
    try { deliveryRegistry.attachArtifacts(receipt.id, artifacts, fulfillmentStatus); } catch (_) { /* non-fatal */ }
  }
  return { ok: true, receiptId: receipt.id, fulfillmentStatus, delivered, total: artifacts.length, requiresHumanFulfillment, artifacts };
}

module.exports = {
  fulfillReceipt, fulfillService, pickRecipe, isEnterprise, needsHumanFulfillment,
  shouldUseAiForSku, aiSkuAllowlist,
  fulfillmentAiOs,
  RECIPES, GENERIC_RECIPE, ENTERPRISE_RECIPE, PROFESSIONAL_RECIPE, SKU_RECIPES,
};
