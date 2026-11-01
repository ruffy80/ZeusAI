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
try { aiProviders = require('../../../backend/modules/aiProviders'); } catch (_) { aiProviders = null; }
let fulfillmentAiOs = null;
try { fulfillmentAiOs = require('../../../backend/modules/fulfillment-ai-os'); } catch (_) { fulfillmentAiOs = null; }
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
  'instant-endpoint-ledger': 'security-desk',
  'instant-control-evidence': 'security-desk',
  'instant-network-partition': 'security-desk',
  'instant-security-test-brief': 'security-desk',
  'instant-operations-watch': 'security-desk',
  'instant-incident-clock': 'security-desk',
  'instant-security-program': 'security-desk',
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
    id: 'security-desk', format: 'markdown',
    match: (s) => /endpoint-ledger|control-evidence|network-partition|security-test-brief|operations-watch|incident-clock|security-program/.test(s),
    title: 'Security desk file',
    system: 'Write the security file from the order brief. Do not invent a scan, a certificate, or an exploit step.',
    prompt: (ctx) => `Write the security desk file for this order. Use only names in the brief. Context: ${ctx}.`,
  },
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

const RECIPE_OUTLINE = {
  'website-audit': ['Scorecard', 'SEO findings', 'Performance', 'Accessibility', '30-day fix plan'],
  'seo-content-pack': ['Keywords', 'Title and meta', 'Article', 'Internal links'],
  'landing-page': ['Hero', 'Benefits', 'FAQ', 'Call to action'],
  'brand-kit': ['Name candidates', 'Positioning', 'Taglines', 'Voice', 'Color and type'],
  'pitch-deck': ['Problem', 'Solution', 'Market', 'Product', 'Ask'],
  'email-sequence': ['Subject', 'Preview', 'Body', 'Send timing', 'Call to action'],
  'social-kit': ['Weekly theme', 'Hooks', 'Captions', 'Hashtags'],
  'resume': ['Resume', 'LinkedIn headline', 'About section'],
  'security-desk': ['Order Summary', 'What Is Included', 'Next Steps', 'Download Instructions'],
  'code-scaffold': ['Architecture', 'Stack', 'Build plan', 'Starter code', 'Deploy checklist'],
  'ad-copy': ['Headlines', 'Descriptions', 'Audience', 'Testing plan'],
  'product-desc': ['Title', 'Bullets', 'Description', 'Upsells', 'FAQ'],
  'consulting-brief': ['Objectives', 'Execution plan', 'Templates', 'KPIs', '30-day timeline'],
  'enterprise-engagement': ['Outcomes', 'Architecture', 'Scope phases', 'Milestones', 'Next steps'],
  'professional-kickoff': ['Goals', 'Scope', 'Architecture sketch', 'Milestones', 'What you have now'],
};

const PACK_SECTIONS = ['Order Summary', 'What Is Included', 'Next Steps', 'Receipt references', 'Download links'];
const KICKOFF_SECTIONS = ['Order Summary', 'What Is Included', 'Scope', 'Architecture sketch', 'Milestones', 'Next Steps', 'Receipt references'];

function proposalPath(serviceId) {
  return '/api/shelf/proposal/' + encodeURIComponent(String(serviceId || ''));
}

function figureLabel(item) {
  const price = Number(item && item.priceUsd) || 0;
  const text = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const per = item && item.billing === 'annual' ? '/yr' : '';
  return '$' + text + per;
}

function catalogFacts(id) {
  try {
    const row = require('../../commerce/enterprise-catalog').byId(id);
    if (!row) return { sla: '', inputs: [] };
    const inputs = Array.isArray(row.inputs)
      ? row.inputs.map((field) => (field && (field.label || field.key)) || '').filter(Boolean)
      : [];
    return { sla: row.sla ? String(row.sla) : '', inputs };
  } catch (_) {
    return { sla: '', inputs: [] };
  }
}

function buildEngagementProposal(item) {
  const figure = figureLabel(item);
  const title = item.title || item.id;
  const catalog = catalogFacts(item.id);
  return [
    '# Engagement Proposal',
    '',
    `Service: ${title}`,
    `Service ID: ${item.id}`,
    `Listed figure: ${figure}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This file is the proposal for the listed figure. Downloading it does not open a cart and does not collect payment.',
    'It does not deliver the license, the source, or a private cloud.',
    '',
    '## Outcomes',
    item.description || title,
    catalog.sla ? ('Published timing on the catalog row: ' + catalog.sla) : '',
    catalog.inputs.length ? ('The signed engagement asks for: ' + catalog.inputs.join(', ') + '.') : '',
    '',
    '## Architecture',
    'A signed engagement would scope the architecture from the description above. This file does not deploy it.',
    '',
    '## Scope phases',
    '1. Read this proposal.',
    '2. Pay the engagement kickoff if you want the discovery brief and a draft statement of work. That payment is credited toward a signed engagement.',
    '3. The kickoff is https://zeusai.pro/checkout/?plan=ent-engagement-kickoff',
    '4. Or send the request at https://zeusai.pro/enterprise#enterprise-contact',
    '5. Milestone delivery of the named engagement happens only after a signed statement of work.',
    '',
    '## Milestones',
    `The listed figure is ${figure}. It is not charged by this download. The payable start is the engagement kickoff.`,
    '',
    '## Next steps',
    '1. Keep this file.',
    '2. Use the kickoff checkout for the paid start, or the contact form to ask for the engagement.',
    '3. Do not treat this download as delivery of the product named above.',
    '',
    'This document is your engagement proposal. Delivery of the license, the source, or a private cloud is executed only after a signed engagement.',
    '',
  ].join('\n');
}

function buildIndustryBrief(vertical) {
  const figure = '$' + Number(vertical.priceUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [
    '# Industry Architecture Brief',
    '',
    `Industry: ${vertical.title}`,
    `Page ID: ${vertical.id}`,
    `Listed workspace figure: ${figure}`,
    `KPI focus named on the page: ${vertical.kpi}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This file is the industry brief. Downloading it does not install an operating system, does not deploy agents, and does not open a cart.',
    'The payable start is the engagement kickoff. The listed figure is a proposal for a signed engagement, not a product in stock.',
    '',
    '## Outcomes',
    `The page names a focus of ${vertical.kpi}. A signed engagement would turn that focus into a scoped milestone plan. This file does not report a measured result.`,
    '',
    '## Architecture',
    `${vertical.title} is an architecture brief for that industry. It is not a finished system.`,
    '1. Intake — the buyer states the KPI focus named above.',
    '2. Workflow — the signed engagement turns that focus into milestones.',
    '3. Proof — only a measured result that the engagement later records.',
    '4. Handoff — the kickoff file, then the statement of work.',
    '',
    '## Scope phases',
    '1. Read this brief.',
    '2. Pay the engagement kickoff at https://zeusai.pro/services/ent-engagement-kickoff',
    '3. The kickoff file is the discovery brief, the commercial proposal, and a draft statement of work.',
    '4. The industry system, if commissioned, follows the signed statement of work.',
    '',
    '## Next steps',
    '1. The download stays free.',
    '2. The kickoff is the self-serve payment for an industry pack.',
    '3. A paused dropship parcel and a private cloud are separate offers and are not included.',
    '',
    'This document is the industry brief. It does not deliver a deployed operating system.',
    '',
  ].join('\n');
}

function proposalDocument(serviceId) {
  const id = String(serviceId || '').trim();
  if (!id || id.length > 80 || !/^[a-z0-9-]+$/i.test(id)) return null;
  let item = null;
  try { item = require('../../commerce/public-shelf').byId(id); } catch (_) { item = null; }
  if (item && item.mode === 'contact') {
    const content = buildEngagementProposal(item);
    return {
      ok: true,
      id,
      kind: 'proposal',
      filename: id + '-engagement-proposal.md',
      contentType: 'text/markdown; charset=utf-8',
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
    };
  }
  try {
    if (require('../../commerce/money-catalog').byId(id)) return null;
  } catch (_) { /* proposal files below */ }
  if (id === 'frontier-desk') {
    const content = [
      '# Frontier Desk Brief',
      '',
      'Generated: ' + new Date().toISOString(),
      '',
      'This file lists the frontier tools that already have a page. It does not sell orbital compute, a neural implant, or a quantum channel.',
      '',
      '## Tools',
      '- F1 Crypto refund guarantee: /refund. A signed intent. Settlement is owner-processed.',
      '- F2 Live conversion aura: /aura.',
      '- F3 Outcome list: /api/outcome/list, opened in the page inspector.',
      '- F4 Checkout cascade probe: /checkout/.',
      '- F5 Time-locked discount, F6 receipt lookup, F7 email proof, F12 carbon estimate: the workshop on /frontier.',
      '- F8 Gift: /gift.',
      '- F9 Pledge: /pledge.',
      '- F10 Cancel: /cancel.',
      '- F11 Bandit transparency: /transparency.',
      '',
      'The priced frontier tools are on the shelf. This brief does not sell orbital compute, a neural implant, or a quantum channel.',
      '',
    ].join('\n');
    return {
      ok: true,
      id,
      kind: 'research-brief',
      filename: 'frontier-desk-brief.md',
      contentType: 'text/markdown; charset=utf-8',
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
    };
  }
  let vertical = null;
  try { vertical = require('../../../backend/modules/programmatic-seo-engine').getVertical(id); } catch (_) { vertical = null; }
  if (vertical) {
    const content = buildIndustryBrief(vertical);
    return {
      ok: true,
      id,
      kind: 'industry-brief',
      filename: id + '-industry-brief.md',
      contentType: 'text/markdown; charset=utf-8',
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
    };
  }
  return null;
}

function proposalHttp(serviceId) {
  const doc = proposalDocument(serviceId);
  if (!doc) {
    return {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: 'no_proposal_file' }),
    };
  }
  return {
    status: 200,
    headers: {
      'Content-Type': doc.contentType,
      'Content-Disposition': 'attachment; filename="' + doc.filename + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    body: doc.content,
  };
}

function offerPreview(serviceId, opts) {
  try {
    const money = require('../../commerce/money-catalog').byId(serviceId);
    if (money) {
      return {
        kind: 'activation',
        fileTitle: money.fileTitle,
        sections: money.sections.slice(),
        note: money.note,
      };
    }
  } catch (_) { /* shelf preview below */ }
  const mode = opts && opts.mode;
  const clock = opts && opts.clock;
  if (mode === 'unavailable') {
    return {
      kind: 'proposal',
      fileTitle: 'Engagement Proposal',
      sections: [],
      note: 'This offer is not for sale. Nothing is downloaded.',
    };
  }
  if (mode === 'contact') {
    return {
      kind: 'proposal',
      fileTitle: 'Engagement Proposal',
      sections: (RECIPE_OUTLINE['enterprise-engagement'] || []).slice(),
      downloadHref: proposalPath(serviceId),
      note: 'Download this proposal now. It states the listed figure and the work a signed engagement would cover. It does not deliver the license, the source, or a private cloud, and it does not open a cart.',
    };
  }
  if (String(serviceId || '') === 'ent-engagement-kickoff') {
    return {
      kind: 'kickoff',
      fileTitle: 'Engagement Kickoff',
      sections: ['Discovery brief', 'Commercial proposal', 'Draft statement of work'],
      note: 'Payment issues this file. It is the discovery brief, the commercial proposal, and a draft statement of work. The amount is credited toward a signed engagement. It does not deliver the license, the source, or a private cloud.',
    };
  }
  if (/^ent-/i.test(String(serviceId || '')) && String(serviceId) !== 'ent-engagement-kickoff') {
    return {
      kind: 'kickoff',
      fileTitle: 'Engagement Pack',
      sections: ['MSA', 'Statement of work', 'Technical appendix', 'Security pack', 'Timeline', 'Payment schedule'],
      note: 'Payment issues this engagement pack. The license, the source, and a private cloud are milestones in the pack. They are not in this download.',
    };
  }
  const human = mode === 'reserve' || clock === 'days' || clock === 'contract';
  const recipe = human
    ? ((clock === 'contract' || (opts && opts.tier === 'enterprise')) ? ENTERPRISE_RECIPE : PROFESSIONAL_RECIPE)
    : pickRecipe(serviceId);
  const armed = !human && shouldUseAiForSku(serviceId);
  if (!armed) {
    const outline = RECIPE_OUTLINE[recipe.id] || PACK_SECTIONS;
    return {
      kind: human ? 'kickoff' : 'activation',
      fileTitle: human ? 'Project Kickoff Pack' : 'Service Activation Pack',
      sections: human ? KICKOFF_SECTIONS.slice() : outline.slice(),
      note: human
        ? 'Payment unlocks this kickoff file now. Scope, the architecture sketch, and the milestones are in the file. The price is the price of this file. The finished build is not in this file. It is not an instant download.'
        : 'Payment unlocks this activation file. The written work is inside it, from your brief. A model key is not required for that copy.',
    };
  }
  const sections = RECIPE_OUTLINE[recipe.id] || PACK_SECTIONS;
  return {
    kind: 'generated',
    fileTitle: recipe.title,
    sections: sections.slice(),
    note: 'After payment, this file is written from your brief. The headings are the template, not a past customer.',
  };
}

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

function clipText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 400);
}

function buyerLines(receipt) {
  const inputs = (receipt && receipt.meta && receipt.meta.inputs)
    || (receipt && receipt.buyer && receipt.buyer.inputs)
    || {};
  const lines = [];
  if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) {
    Object.keys(inputs).forEach((key) => {
      if (String(key).toLowerCase() === 'email') return;
      const value = clipText(inputs[key], 500);
      if (value) lines.push(key + ': ' + value);
    });
  }
  const brief = receipt && receipt.meta && receipt.meta.brief ? clipText(receipt.meta.brief, 800) : '';
  if (brief) lines.push('brief: ' + brief);
  return lines;
}

function seedText(receipt, serviceId) {
  const joined = buyerLines(receipt).join(' ');
  return joined.slice(0, 240) || String(serviceId || 'the offer');
}

function nameCandidates(seed) {
  const word = String(seed || 'Atlas').replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/)[0] || 'Atlas';
  const stem = word.slice(0, 16);
  return [stem, stem + 'ly', stem + 'os', stem + 'lab', 'North' + stem, stem + 'line', stem + 'kit', stem + 'works'];
}

function writtenDeliverable(serviceId, receipt, recipe, opts) {
  const recipeId = recipe && recipe.id;
  const seed = seedText(receipt, serviceId);
  const quoted = buyerLines(receipt);
  const briefBlock = quoted.length
    ? quoted.map((line) => '- ' + line).join('\n')
    : '- No extra brief was on the order. The copy below uses the service id.';
  if (String(serviceId || '') === 'ent-engagement-kickoff') {
    return [
      '## Discovery brief',
      'This discovery brief restates the paid start for ' + clipText(serviceId, 80) + '.',
      briefBlock,
      'It does not deliver the license, the source, or a private cloud.',
      '',
      '## Commercial proposal',
      'This commercial proposal is the paid start. The amount is credited toward a signed engagement.',
      '',
      '## Draft statement of work',
      'This draft statement of work is the download. The license, the source, and a private cloud are not in this download.',
    ].join('\n');
  }
  if (opts && (opts.enterprise || opts.professional || opts.requiresHuman)) {
    return [
      '## Scope',
      briefBlock,
      '',
      '## Architecture sketch',
      'The architecture sketch names the components for ' + clipText(serviceId, 80) + '. This file is the kickoff. The finished build is not in this file.',
      '',
      '## Milestones',
      '1. This kickoff file is the paid delivery.',
      '2. The scope above is the scope of this file.',
      '3. A later build is not included. The price is the price of this file.',
      '',
      'The finished build is not in this file. It is not an instant download of a finished system.',
    ].join('\n');
  }
  if (recipeId === 'security-desk') {
    return require('../../commerce/security-desk').deliver(serviceId, quoted);
  }
  if (recipeId === 'website-audit') {
    const scan = receipt && (receipt.auditScan || (receipt.meta && receipt.meta.auditScan));
    let body = '';
    try {
      body = require('../../commerce/audit-scan').render({ seed, quoted, scan });
    } catch (err) {
      body = [
        '## Scorecard',
        'Subject: ' + seed,
        'No score is filled in. Fetch failed: ' + clipText(err && err.message, 80) + '.',
      ].join('\n');
    }
    try { body += '\n' + require('../../../modules/witness/routes').citationBlock(serviceId || 'instant-website-audit'); }
    catch (_) { /* citation is optional */ }
    return body;
  }
  if (recipeId === 'seo-content-pack') {
    return [
      '## Keywords',
      seed,
      '',
      '## Title and meta',
      'Title: A practical guide to ' + clipText(seed, 80),
      'Meta description: A single article for the words above. It does not claim a ranking.',
      '',
      '## Article',
      clipText(seed, 180) + ' is the subject of this article. Start by naming the reader and the job they are trying to finish. Then list the three steps they can do this week: write the offer in one sentence, point one internal link at that offer, and check the title tag against the same sentence.',
      '',
      'The second section explains what to leave out. Do not add a customer quote, a traffic number, or a ranking. Those are not in this order.',
      '',
      'The close asks for one action: publish the page, then measure it with the site\'s own logs.',
      '',
      '## Internal links',
      '- Link the article to the service page that sells the offer.',
      '- Link once to the contact or checkout path that matches that offer.',
    ].join('\n');
  }
  if (recipeId === 'landing-page') {
    const headline = clipText(seed, 90) || 'The offer';
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + headline.replace(/</g, '') + '</title><style>body{font:16px/1.5 sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}a{background:#111;color:#fff;padding:.7rem 1rem;text-decoration:none}</style></head><body><h1>' + headline.replace(/</g, '') + '</h1><p>The benefits are the ones named in the order brief.</p><h2>FAQ</h2><p>This file is the page. It is not a hosted site.</p><a href="#buy">Continue</a></body></html>';
    return [
      '## Hero',
      headline,
      '',
      '## Benefits',
      briefBlock,
      '',
      '## FAQ',
      'This page is one self-contained HTML file. It is not a hosted site and it has no external images.',
      '',
      '## Call to action',
      'Continue to the shelf checkout for this offer.',
      '',
      '```html',
      html,
      '```',
    ].join('\n');
  }
  if (recipeId === 'brand-kit') {
    const names = nameCandidates(seed);
    return [
      '## Name candidates',
      'Eight name candidates are spelling candidates. This file does not check whether a domain is available.',
      names.map((name, index) => (index + 1) + '. ' + name).join('\n'),
      '',
      '## Positioning',
      clipText(seed, 200) + ' — one offer, one reader, one next step.',
      '',
      '## Taglines',
      '1. Start with the work.',
      '2. The file is the first delivery.',
      '3. Say the offer in one line.',
      '4. Keep the next step visible.',
      '5. Leave out a claim you cannot show.',
      '',
      '## Voice',
      'Audience: the reader named in the brief.',
      'Tone: short sentences. Name the file. Do not invent a customer.',
      'Sample lines: The file is the delivery. Leave out a claim you cannot show.',
      'This is written voice, not a designed brand book, and it is not a finished voice guide as a PDF.',
      '',
      '## Color and type',
      'Ink #111111, paper #f7f4ef, accent #0b8a3e. A neutral sans for the interface and a serif for the name.',
      'This file does not include logo image files, a favicon, or visual variants.',
    ].join('\n');
  }
  if (recipeId === 'pitch-deck') {
    return [
      '## Problem',
      seed,
      '',
      '## Solution',
      'The offer named in the brief, stated in one paragraph.',
      '',
      '## Market',
      'Name the buyer who already has the problem. Do not invent a market size.',
      '',
      '## Product',
      'What this file includes, taken from the brief above. A later build is not in this file.',
      '',
      '## Ask',
      'The listed shelf price for this offer. This markdown is the slide copy. It is not a designed slide deck.',
    ].join('\n');
  }
  if (recipeId === 'email-sequence') {
    const emails = [1, 2, 3, 4, 5].map((n) => [
      '## Email ' + n,
      'Subject: ' + clipText(seed, 60) + ' — step ' + n,
      'Preview: The next step is in the first line.',
      'Body: Email ' + n + ' of 5. Restate the offer, give one action, and stop.',
      'Send timing: day ' + (n - 1),
      'Call to action: Open the shelf page for this offer.',
      '',
    ].join('\n'));
    return ['Five emails follow.', ''].concat(emails).join('\n');
  }
  if (recipeId === 'social-kit') {
    const posts = [1, 2, 3, 4, 5, 6, 7].map((n) => (
      n + '. Hook: ' + clipText(seed, 50) + '. Caption: Post ' + n + ' of seven. One idea, one next step. Hashtags: #' + clipText(serviceId, 24).replace(/[^a-z0-9]/gi, '')
    ));
    return [
      '## Weekly theme',
      'Seven text posts for the channels named in the brief. Each one has a hook, a caption, and hashtags.',
      '',
      '## Hooks, captions, hashtags',
      posts.join('\n'),
      '',
      'This file is not thirty finished posts and it has no image files.',
    ].join('\n');
  }
  if (recipeId === 'resume') {
    return [
      '## Resume',
      briefBlock,
      'Use only the jobs and dates that are in the source text above. This file does not invent an employer.',
      '',
      '## LinkedIn headline',
      clipText(seed, 80) || 'Role from the order brief',
      '',
      '## About section',
      'Three lines: the role, the kind of work, and the next step. No photo.',
      'This is not a Word file.',
    ].join('\n');
  }
  if (recipeId === 'code-scaffold') {
    return [
      '## Architecture',
      'One web entry, one API, one data store. Named for ' + clipText(serviceId, 80) + '.',
      '',
      '## Stack',
      'The public site is Node. Keep the new module in that runtime.',
      '',
      '## Build plan',
      '1. Confirm the brief.',
      '2. Name the routes.',
      '3. The running build follows the kickoff window when this id is a professional engagement.',
      '',
      '## Starter code',
      'This activation copy is the plan. It is not a running application.',
      '',
      '## Deploy checklist',
      '- Health check returns.',
      '- The buyer file matches the brief.',
    ].join('\n');
  }
  return [
    '## Objectives',
    briefBlock,
    '',
    '## Execution plan',
    '1. Restate the offer ' + clipText(serviceId, 80) + '.',
    '2. Do the next concrete step named in the brief.',
    '3. Record what was delivered in this file.',
    '',
    '## Templates',
    'Use the headings in this pack as the working document.',
    '',
    '## KPIs',
    'Count only what the order can show. Do not invent a reach number.',
    '',
    '## 30-day timeline',
    'Week 1 confirm the brief. Week 2 produce the file. Week 3 review it. Week 4 close the open questions.',
  ].join('\n');
}

function buildDeterministicArtifact(receipt, serviceId, recipe, opts = {}) {
  const human = !!(opts.enterprise || opts.professional || opts.requiresHuman);
  const enterprise = !!opts.enterprise;
  const refs = receiptRefs(receipt);
  const nextSteps = human
    ? [
        'Read the scope and the milestones in this file.',
        'The price is the price of this file.',
        'Use the receipt links below for the order record.',
        'The finished build is not in this file.'
      ]
    : [
        'Download the signed receipt from the links below.',
        'Open the onboarding payload and provide any missing business inputs.',
        'Read the written deliverable in this same file. It was produced from the order brief.',
        'A model may add copy only when a provider key is armed. The headings in this file stay.'
      ];
  const track = enterprise
    ? 'Track: engagement pack. The license, the source, and a private cloud are not in this download.'
    : (opts.professional
      ? 'Track: project kickoff. The finished build is not in this file.'
      : 'Track: digital activation pack. The written deliverable in this file was produced without a model.');
  const work = writtenDeliverable(serviceId, receipt, recipe, opts);
  const content = sealFile(compactLines([
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
      ? (enterprise
        ? `This file is the engagement pack for "${recipe.title}". The documents in this download are the delivery.`
        : `This file is the project kickoff for "${recipe.title}". Scope, the architecture sketch, and the milestones are the delivery. The price is the price of this file.`)
      : `This pack is the immediate activation deliverable for "${recipe.title}". The written work is in this file. It was produced from the order brief by the deterministic engine. It is not a model reply. When a provider key is armed for an allowlisted SKU, a model may add copy. The headings in this file stay.`,
    '',
    '## Written deliverable',
    work,
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
      ? 'The finished build is not in this file.'
      : 'This artifact is intentionally deterministic and never claims AI generation when AI was not actually used.',
  ]).join('\n'), {
    id: serviceId,
    title: receipt && (receipt.serviceName || receipt.plan) ? (receipt.serviceName || receipt.plan) : recipe.title,
    description: recipe && recipe.title,
  });

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
      'instant-resume-makeover',
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

function engagementContext(receipt, serviceId) {
  const catalog = require('../../commerce/enterprise-catalog').byId(serviceId);
  const paid = receiptAmountUsd(receipt);
  const listed = catalog && Number(catalog.priceUSD) > 0 ? Number(catalog.priceUSD) : paid;
  return {
    packId: 'pack_' + String(receipt && (receipt.id || receipt.orderId) || serviceId).replace(/[^a-z0-9]/gi, '').slice(0, 24),
    dealId: receipt && (receipt.id || receipt.orderId) || null,
    buyer: {
      email: receipt && (receipt.email || (receipt.buyer && receipt.buyer.email)) || '',
    },
    product: {
      id: serviceId,
      title: (catalog && catalog.title) || (receipt && (receipt.serviceName || receipt.plan)) || serviceId,
      description: catalog && catalog.description,
    },
    kickoffUsd: paid > 0 ? paid : listed,
    acv: { accepted: listed, mid: listed },
  };
}

function attachEnterprisePack(artifact, receipt, serviceId, persist) {
  if (!artifact || !/^ent-/i.test(String(serviceId || '')) || serviceId === 'ent-engagement-kickoff') return artifact;
  const line = 'The license, the source, and a private cloud are milestones in the statement of work. They are not in this download.';
  let extra = '\n\n## Engagement pack\nPayment issues the engagement pack. ' + line + '\n';
  try {
    const pack = require('../../commerce/enterprise-proposal-pack');
    const ctx = engagementContext(receipt, serviceId);
    extra += pack.renderPack(ctx);
    if (persist !== false) {
      const generated = pack.generatePack(ctx);
      const names = (generated.documents || []).map((doc) => doc.key).join(', ');
      extra += '\nDocuments: ' + names + '.\nPack ID: ' + generated.packId + '\n';
      artifact.engagementPackId = generated.packId;
      artifact.engagementDocuments = (generated.documents || []).map((doc) => doc.key);
    } else {
      artifact.engagementDocuments = ['msa', 'sow', 'technical-appendix', 'security-compliance', 'timeline-milestones', 'payment-schedule'];
    }
  } catch (_) { /* the sentence above still ships with the file */ }
  artifact.content = String(artifact.content || '') + extra;
  artifact.bytes = Buffer.byteLength(artifact.content, 'utf8');
  artifact.deliverableType = 'enterprise-pack';
  if (!/not in this download/i.test(artifact.content)) {
    artifact.content += '\n' + line + '\n';
    artifact.bytes = Buffer.byteLength(artifact.content, 'utf8');
  }
  return artifact;
}

function buyerReceipt(item) {
  const id = String(item && item.id || '');
  return {
    id: 'dip-' + id,
    email: 'buyer@example.com',
    serviceId: id,
    plan: id,
    services: [id],
    amount: Number(item && item.priceUsd) || 0,
    status: 'paid',
    serviceName: item && item.title ? item.title : id,
  };
}

function sealFile(content, item) {
  try { return require('../../commerce/finished-delivery').stamp(content, item); }
  catch (_) { return content; }
}

function buyerFile(item) {
  const serviceId = String(item && item.id || '');
  const receipt = buyerReceipt(item);
  try {
    const row = require('../../commerce/money-catalog').byId(serviceId);
    if (row) return sealFile(require('../../commerce/money-catalog').render(row, receipt), item);
  } catch (_) { /* shelf recipes below */ }
  if (item && item.mode === 'contact') {
    const doc = proposalDocument(serviceId);
    return doc && doc.content ? sealFile(doc.content, item) : '';
  }
  if (item && item.mode === 'unavailable') return '';
  const enterprise = isEnterprise(receipt, serviceId);
  const professional = !enterprise && needsHumanFulfillment(receipt, serviceId);
  const human = enterprise || professional;
  const recipe = enterprise
    ? ENTERPRISE_RECIPE
    : (professional ? PROFESSIONAL_RECIPE : pickRecipe(serviceId));
  const artifact = buildDeterministicArtifact(receipt, serviceId, recipe, {
    enterprise,
    professional,
    requiresHuman: human,
    reason: 'delivery_integrity',
  });
  return sealFile(attachEnterprisePack(artifact, receipt, serviceId, false).content, item);
}

async function fulfillService(receipt, serviceId) {
  try {
    const money = require('../../commerce/money-catalog');
    const row = money.byId(serviceId);
    if (row) return money.artifact(receipt, row);
  } catch (_) { /* generic recipes below */ }
  const enterprise = isEnterprise(receipt, serviceId);
  const professional = !enterprise && needsHumanFulfillment(receipt, serviceId);
  const human = enterprise || professional;
  const recipe = enterprise
    ? ENTERPRISE_RECIPE
    : (professional ? PROFESSIONAL_RECIPE : pickRecipe(serviceId));
  const tier = enterprise ? 'enterprise' : (professional ? 'professional' : 'standard');
  if (recipe && recipe.id === 'website-audit') {
    try {
      const scanner = require('../../commerce/audit-scan');
      const pageUrl = scanner.urlFromReceipt(receipt);
      receipt.auditScan = pageUrl
        ? await scanner.scan(pageUrl)
        : { fetched: false, score: null, reason: 'url_missing', checks: [] };
    } catch (err) {
      receipt.auditScan = { fetched: false, score: null, reason: String(err && err.code || err && err.message || 'fetch_failed').slice(0, 80), checks: [] };
    }
    return attachEnterprisePack(buildDeterministicArtifact(receipt, serviceId, recipe, {
      enterprise,
      professional,
      requiresHuman: human,
      reason: 'measured_page',
    }), receipt, serviceId);
  }
  // High-ticket / professional stays on engagement/kickoff packs (never fake "AI delivered product").
  const shouldUseAi = !human && shouldUseAiForSku(serviceId);
  if (shouldUseAi && fulfillmentAiOs && typeof fulfillmentAiOs.reloadKeysFromSanctum === 'function') {
    try { fulfillmentAiOs.reloadKeysFromSanctum(); } catch (_) { /* non-fatal */ }
  }
  if (!shouldUseAi || !aiProviders || typeof aiProviders.chat !== 'function') {
    return attachEnterprisePack(buildDeterministicArtifact(receipt, serviceId, recipe, {
      enterprise,
      professional,
      requiresHuman: human,
      reason: !shouldUseAi ? 'ai_disabled' : 'ai_layer_unavailable'
    }), receipt, serviceId);
  }
  try {
    const result = await aiProviders.chat(recipe.prompt(contextFor(receipt, serviceId)), [], human ? { premiumOnly: false } : {});
    const reply = result && result.reply ? String(result.reply) : '';
    if (!reply) {
      return attachEnterprisePack(buildDeterministicArtifact(receipt, serviceId, recipe, {
        enterprise,
        professional,
        requiresHuman: human,
        reason: 'ai_null_response'
      }), receipt, serviceId);
    }
    let content = reply.slice(0, MAX_ARTIFACT_CHARS);
    let shelfItem = null;
    try {
      const dip = require('../../commerce/delivery-integrity');
      try { shelfItem = require('../../commerce/public-shelf').byId(serviceId); } catch (_) { shelfItem = null; }
      const preview = offerPreview(serviceId, shelfItem || {});
      const floor = buyerFile(shelfItem || { id: serviceId, title: serviceId, priceUsd: receiptAmountUsd(receipt), mode: 'btc', clock: 'minutes' });
      content = dip.keepSections(content, preview && preview.sections, floor);
    } catch (_) { /* the model text still returns */ }
    content = sealFile(content, shelfItem || { id: serviceId, title: serviceId });
    return attachEnterprisePack({
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
    }, receipt, serviceId);
  } catch (e) {
    return attachEnterprisePack(buildDeterministicArtifact(receipt, serviceId, recipe, {
      enterprise,
      professional,
      requiresHuman: human,
      reason: 'ai_error:' + String(e && e.message || e)
    }), receipt, serviceId);
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

function fulfillReceiptBlocking(receipt) {
  const { spawnSync } = require('child_process');
  const script = [
    'const engine = require(' + JSON.stringify(require.resolve('./fulfillment-engine')) + ');',
    'const receipt = JSON.parse(process.argv[1]);',
    'Promise.resolve(engine.fulfillReceipt(receipt)).then((result) => {',
    '  process.stdout.write(JSON.stringify({ ok: !!(result && result.ok), delivered: result && result.delivered, total: result && result.total, fulfillmentStatus: result && result.fulfillmentStatus }));',
    '}).catch((err) => {',
    '  process.stderr.write(String(err && err.stack || err));',
    '  process.exit(1);',
    '});',
  ].join('\n');
  const child = spawnSync(process.execPath, ['-e', script, JSON.stringify(receipt)], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    timeout: 20000,
  });
  if (!child.stdout) {
    return { ok: false, error: String(child.stderr || child.error || 'fulfillment_blocked').slice(0, 200) };
  }
  try {
    return JSON.parse(String(child.stdout).trim());
  } catch (err) {
    return { ok: false, error: 'fulfillment_unreadable' };
  }
}

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
  fulfillReceipt, fulfillReceiptBlocking, fulfillService, pickRecipe, offerPreview, proposalDocument, proposalHttp, isEnterprise, needsHumanFulfillment,
  buyerFile,
  shouldUseAiForSku, aiSkuAllowlist,
  fulfillmentAiOs,
  RECIPES, GENERIC_RECIPE, ENTERPRISE_RECIPE, PROFESSIONAL_RECIPE, SKU_RECIPES,
};
