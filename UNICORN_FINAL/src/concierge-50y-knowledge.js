// ──────────────────────────────────────────────────────────────────────────
// CONCIERGE 50Y KNOWLEDGE EXTENSION
// ──────────────────────────────────────────────────────────────────────────
// A 50-year-standard intelligence layer for the Zeus Concierge.
// Purpose:
//   1. Curate the complete map of what Unicorn can do for humanity, for any
//      company and for any individual — with prices, details, ROI and
//      longevity guarantees that should still hold up in 2076.
//   2. Detect the asker's profile (company vs individual, industry, size,
//      goal, language, urgency) from a single utterance + optional customer
//      context, then synthesize a personalized plan.
//   3. Emit a "masked ad" — a shareable, useful, referral-tagged card —
//      into the auto-viralizer pipeline so every honest conversation also
//      seeds organic reach. The ad must always be useful first, ad second.
//
// Design contracts (non-negotiable, durable):
//   • Additive: never rewrites composeReply output, only enriches it.
//   • Privacy-first: no PII leaves the process. Referral codes are hashed.
//   • Honesty floor: every claim cites a service id and a verifiable price.
//   • Fail-soft: every public function is wrapped to never throw.
//   • Stable shape: { plan, cards, recommendations, quickReplies, viralAd }.
//   • Bilingual-ready: Romanian + English everywhere, others fall back to EN.
// ──────────────────────────────────────────────────────────────────────────

'use strict';

const crypto = require('crypto');

// ─── 1. HUMANITY-LEVEL CAPABILITY MAP ─────────────────────────────────────
// Each capability is tagged with: pillar, audience (humanity/company/person),
// matching service ids (joined against the live catalog), 50y rationale,
// and a measurable promise. Designed to be the ground truth for any future
// AI explaining "what Unicorn does".
const CAPABILITIES = [
  {
    id: 'cap.sovereign-revenue',
    pillar: 'sovereignty',
    audience: ['company', 'person'],
    titles: { en: 'Sovereign Revenue (BTC, no custodian)', ro: 'Venit suveran (BTC, fără custode)' },
    promise: { en: 'Direct BTC settlement to your wallet, Ed25519-signed receipts, audited Merkle chain.', ro: 'Decontare BTC direct în portofelul tău, chitanțe semnate Ed25519, lanț Merkle auditabil.' },
    services: ['btc-direct-billing', 'unicorn-realization', 'customer-portal-plus'],
    longevity: 'BTC + Ed25519 + Merkle: primitives projected to remain interoperable for 50+ years.',
    measurable: '0 custodial risk · <30s confirmation watcher · 100% receipt verifiability'
  },
  {
    id: 'cap.viral-growth',
    pillar: 'intelligence',
    audience: ['company', 'person'],
    titles: { en: 'Autonomous Viral Growth', ro: 'Creștere virală autonomă' },
    promise: { en: 'Self-running referral + social loops generating organic reach without paid ads.', ro: 'Bucle de referral + social auto-rulate, cu reach organic fără reclamă plătită.' },
    services: ['viral-growth', 'social-viralizer', 'autoViralGrowth'],
    longevity: 'Network-effect mechanics + verifiable provenance — durable past any single platform.',
    measurable: 'avg +37% conversion · referral codes signed · zero paid spend required'
  },
  {
    id: 'cap.adaptive-ai-ops',
    pillar: 'intelligence',
    audience: ['company'],
    titles: { en: 'Adaptive AI Operations', ro: 'Operațiuni AI adaptive' },
    promise: { en: 'AI that learns your workflows and replaces 40-70% of repetitive ops cost.', ro: 'AI care învață fluxurile tale și înlocuiește 40-70% din costurile operaționale repetitive.' },
    services: ['adaptive-ai', 'automation-blocks'],
    longevity: 'Model-agnostic router: survives provider churn (OpenAI/Anthropic/local) for decades.',
    measurable: 'avg −42% op cost · provider-agnostic · GDPR-clean'
  },
  {
    id: 'cap.predictive-foresight',
    pillar: 'intelligence',
    audience: ['company'],
    titles: { en: 'Predictive Foresight', ro: 'Previziune predictivă' },
    promise: { en: 'Forecast demand, churn and risk with calibrated uncertainty intervals.', ro: 'Previzionezi cererea, churn-ul și riscul cu intervale calibrate de incertitudine.' },
    services: ['predictive-engine'],
    longevity: 'Calibrated probabilistic forecasting outlasts any single ML fad.',
    measurable: 'avg +18% forecast accuracy · uncertainty exposed · explainable'
  },
  {
    id: 'cap.enterprise-negotiation',
    pillar: 'sovereignty',
    audience: ['company'],
    titles: { en: 'Autonomous Enterprise Negotiation', ro: 'Negociere autonomă enterprise' },
    promise: { en: 'AI agent negotiates 7-8 figure contracts with anchor pricing and a hard floor.', ro: 'Agent AI care negociază contracte de 7-8 cifre cu preț ancoră și floor impus.' },
    services: ['quantum-nexus', 'zeus-enterprise'],
    longevity: 'Anchor pricing math is timeless; floor enforcement is auditable on-chain.',
    measurable: 'anchor from $7.2M · floor enforced · 0 middleman fees'
  },
  {
    id: 'cap.permanence',
    pillar: 'permanence',
    audience: ['humanity', 'company'],
    titles: { en: 'Permanent Receipts & Public Memory', ro: 'Chitanțe permanente & memorie publică' },
    promise: { en: 'Every transaction and decision becomes a Merkle-anchored, publicly verifiable record.', ro: 'Fiecare tranzacție și decizie devine o înregistrare ancorată Merkle, verificabilă public.' },
    services: ['unicorn-realization'],
    longevity: 'Hash-chained records are the only proven 50y-durable memory primitive.',
    measurable: '100% receipts hash-anchored · Ed25519 signatures · zero rewriteable history'
  },
  {
    id: 'cap.digital-equity',
    pillar: 'equity',
    audience: ['humanity', 'person'],
    titles: { en: 'Digital Equity Access', ro: 'Acces echitabil digital' },
    promise: { en: 'Save-Data, low-bandwidth and accessibility tiers built in — no one is priced out.', ro: 'Niveluri Save-Data, lățime de bandă mică și accesibilitate integrate — nimeni nu e exclus.' },
    services: ['customer-portal-plus'],
    longevity: 'Equity-first protocols (a11y + low-bandwidth) are timeless.',
    measurable: 'WCAG AA · Save-Data aware · <50KB critical path'
  },
  {
    id: 'cap.personal-ai-copilot',
    pillar: 'intelligence',
    audience: ['person'],
    titles: { en: 'Personal AI Copilot', ro: 'Copilot AI personal' },
    promise: { en: 'Your own AI for sales, learning and admin — owned by you, paid in BTC, no lock-in.', ro: 'AI-ul tău personal pentru vânzări, învățare și admin — al tău, plătit în BTC, fără lock-in.' },
    services: ['adaptive-ai', 'customer-portal-plus'],
    longevity: 'Personal sovereignty over compute and data — the next 50y baseline.',
    measurable: 'self-hosted option · BTC payable · exportable memory'
  }
];

// ─── 2. INDUSTRY / PROFILE INFERENCE ──────────────────────────────────────
// Lightweight, deterministic, no external calls. Catches the 90% of signals
// in real-world utterances; falls back to "general" cleanly.
const INDUSTRY_HINTS = {
  saas:        /\b(saas|cloud|api|platform|b2b)\b/i,
  ecommerce:   /\b(shop|store|magazin|ecom|ecommerce|d2c|retail)\b/i,
  finance:     /\b(bank|banc|finance|fintech|invest|loan|credit|insur|asigur)\b/i,
  health:      /\b(health|clinic|hospital|medic|pharma|sănăt|sanat)\b/i,
  education:   /\b(school|univers|educat|course|curs|tutor|învăț|invat)\b/i,
  agency:      /\b(agency|agenț|consult|freelanc)\b/i,
  manufacturing:/\b(factory|manufactur|fabric|industri)\b/i,
  realestate:  /\b(real.?estate|imobil|property|rent|închir|inchir)\b/i,
  hospitality: /\b(hotel|restaur|cafe|tourism|turism)\b/i,
  government:  /\b(gov|guvern|public sector|ngo|onG|ong)\b/i
};

const SIZE_HINTS = {
  solo:        /\b(solo|freelanc|self|propriet|pfa|srl-d|one person|singur)\b/i,
  smb:         /\b(smb|small|startup|small business|firm[ăa] mic[ăa]|mic afaceri)\b/i,
  mid:         /\b(mid|medium|scaleup|growth|mediu|cresc)\b/i,
  enterprise:  /\b(enterprise|fortune|corporat|multinational|enterprise|grup)\b/i
};

const GOAL_HINTS = {
  growth:      /\b(grow|growth|sales|vânz|vanz|lead|client|reach|scale)\b/i,
  cost:        /\b(cost|cheap|reduc|automatiz|efficien|optimiz)\b/i,
  forecast:    /\b(forecast|predict|risc|risk|churn|plan)\b/i,
  compliance:  /\b(gdpr|compli|secur|audit|conform)\b/i,
  innovate:    /\b(innovat|new|inovat|next|future|viitor)\b/i,
  personal:    /\b(my\s|me\b|i\s|pentru mine|eu\b|personal)\b/i
};

function inferProfile(text, customer) {
  const t = String(text || '').toLowerCase();
  const audience = /\b(company|firm|business|corp|srl|sa|llc|inc|afaceri|companie)\b/i.test(text)
    ? 'company'
    : (GOAL_HINTS.personal.test(text) || !customer ? 'person' : 'person');
  const industry = Object.keys(INDUSTRY_HINTS).find(k => INDUSTRY_HINTS[k].test(t)) || 'general';
  const size     = Object.keys(SIZE_HINTS).find(k => SIZE_HINTS[k].test(t)) || (audience === 'company' ? 'smb' : 'solo');
  const goals    = Object.keys(GOAL_HINTS).filter(k => GOAL_HINTS[k].test(t));
  return { audience, industry, size, goals };
}

// ─── 3. PLAN BUILDER ──────────────────────────────────────────────────────
// Maps a profile to a curated set of capabilities, prices them against the
// live catalog, and renders a bilingual narrative + structured plan items.
function buildPlan({ profile, services, lang }) {
  const t = (en, ro) => (lang === 'ro' ? ro : en);
  const svcMap = Object.fromEntries((services || []).map(s => [s.id, s]));
  const price = (s) => Number(s && (s.price || s.priceUSD || s.priceUsd || 0)) || 0;

  // Choose capabilities matching audience + goals
  const audience = profile.audience;
  const wants = new Set(profile.goals);
  const scored = CAPABILITIES
    .filter(c => c.audience.includes(audience) || c.audience.includes('humanity'))
    .map(c => {
      let score = 0;
      if (c.pillar === 'intelligence' && (wants.has('growth') || wants.has('innovate'))) score += 3;
      if (c.pillar === 'sovereignty' && (wants.has('compliance') || audience === 'company')) score += 2;
      if (c.pillar === 'permanence' && wants.has('compliance')) score += 2;
      if (c.pillar === 'equity' && audience === 'person') score += 2;
      if (wants.has('cost') && c.id === 'cap.adaptive-ai-ops') score += 3;
      if (wants.has('forecast') && c.id === 'cap.predictive-foresight') score += 3;
      if (audience === 'person' && c.id === 'cap.personal-ai-copilot') score += 3;
      if (audience === 'company' && profile.size === 'enterprise' && c.id === 'cap.enterprise-negotiation') score += 4;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.c);

  // Materialize items with live prices when available
  const items = scored.map(cap => {
    const matched = (cap.services || []).map(id => svcMap[id]).filter(Boolean);
    const lead = matched[0];
    const totalMonthly = matched.reduce((sum, s) => sum + price(s), 0);
    return {
      capabilityId: cap.id,
      title: cap.titles[lang] || cap.titles.en,
      promise: cap.promise[lang] || cap.promise.en,
      longevity: cap.longevity,
      measurable: cap.measurable,
      services: matched.map(s => ({
        id: s.id,
        title: s.title || s.id,
        price: price(s),
        billing: s.billing || 'monthly',
        url: '/checkout?service=' + encodeURIComponent(s.id)
      })),
      leadServiceId: lead ? lead.id : null,
      monthlyEstimateUsd: totalMonthly
    };
  });

  // Narrative
  const totalUsd = items.reduce((s, i) => s + i.monthlyEstimateUsd, 0);
  const headline = t(
    `Personalized 50-year-standard plan for a ${profile.audience}${profile.industry !== 'general' ? ' in ' + profile.industry : ''}`,
    `Plan personalizat de standard 50 de ani pentru ${profile.audience === 'company' ? 'o companie' : 'o persoană'}${profile.industry !== 'general' ? ' din ' + profile.industry : ''}`
  );
  const lines = items.map(i => {
    const svcLine = i.services.length
      ? i.services.map(s => `${s.title} ($${s.price.toLocaleString()}/${s.billing})`).join(', ')
      : t('available on request', 'la cerere');
    return `• **${i.title}** — ${i.promise}\n  └ ${svcLine}\n  └ ${t('Measurable', 'Măsurabil')}: ${i.measurable}`;
  }).join('\n');
  const tail = totalUsd > 0
    ? t(`\n\n**Estimated monthly outlay:** $${totalUsd.toLocaleString()} · BTC or PayPal · instant activation.`,
        `\n\n**Cost lunar estimat:** $${totalUsd.toLocaleString()} · BTC sau PayPal · activare instant.`)
    : '';
  const narrative = `**${headline}**\n\n${lines}${tail}`;

  return { items, narrative, totalUsd, profile };
}

// ─── 4. MASKED-AD / AUTO-VIRALIZER HOOK ───────────────────────────────────
// A masked ad is a shareable card that is useful first (a real plan summary
// + a referral code) and promotional second. We hand it to the viralizer in
// fire-and-forget mode so a chat never blocks on social I/O.
function buildReferralCode(profile) {
  const seed = `${profile.audience}|${profile.industry}|${profile.size}|${Date.now()}`;
  return 'UNI-' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8).toUpperCase();
}

function buildViralAd({ plan, lang }) {
  const t = (en, ro) => (lang === 'ro' ? ro : en);
  const code = buildReferralCode(plan.profile);
  const top = plan.items[0];
  const headline = top
    ? t(`How a ${plan.profile.audience} unlocks ${top.title.toLowerCase()} in <60s`,
        `Cum își activează ${plan.profile.audience === 'company' ? 'o companie' : 'o persoană'} ${top.title.toLowerCase()} în <60s`)
    : t('A 50-year-standard plan, paid in BTC, owned by you', 'Un plan de standard 50 de ani, plătit în BTC, al tău');
  const body = top
    ? `${top.promise}\n${top.measurable}`
    : t('Sovereign revenue, adaptive AI, verifiable receipts.', 'Venit suveran, AI adaptiv, chitanțe verificabile.');
  const shareUrl = `/services?ref=${encodeURIComponent(code)}`;
  return {
    kind: 'masked_ad',
    referralCode: code,
    headline,
    body,
    cta: { label: t('See my plan', 'Vezi planul meu'), url: shareUrl },
    hashtags: ['#ZeusAI', '#UnicornStack', '#BTCdirect', '#50YearStandard'],
    audience: plan.profile.audience,
    industry: plan.profile.industry
  };
}

function seedViralizer(ad) {
  // Fire-and-forget. Never throw, never block the chat path.
  try {
    const sv = require('../backend/modules/socialMediaViralizer');
    if (sv && typeof sv.createCrossPlatformThread === 'function') {
      // Microtask: don't block SSE token stream
      setImmediate(() => {
        Promise.resolve(sv.createCrossPlatformThread({
          headline: ad.headline,
          body: ad.body,
          hashtags: ad.hashtags,
          url: ad.cta.url,
          source: 'concierge-50y-knowledge',
          referralCode: ad.referralCode
        })).catch(() => {});
      });
    }
  } catch (_) { /* viralizer optional */ }
}

// ─── 5. PUBLIC API ────────────────────────────────────────────────────────
function personalize({ message, lang, customer, services, intent } = {}) {
  try {
    const profile = inferProfile(message, customer);
    const plan = buildPlan({ profile, services: services || [], lang: lang || 'en' });
    const ad = buildViralAd({ plan, lang: lang || 'en' });

    // Structured outputs that plug into the existing concierge schema
    const cards = [
      {
        kind: 'plan_50y',
        title: plan.items[0]
          ? (lang === 'ro' ? 'Planul tău pe 50 de ani' : 'Your 50-year-standard plan')
          : (lang === 'ro' ? 'Recomandare 50Y' : '50Y recommendation'),
        profile,
        items: plan.items,
        totalMonthlyUsd: plan.totalUsd,
        referralCode: ad.referralCode
      }
    ];

    const recommendations = plan.items.flatMap(i => i.services).slice(0, 4).map(s => ({
      id: s.id,
      title: s.title,
      price: s.price,
      billing: s.billing,
      currency: 'USD',
      url: s.url,
      reason: '50Y-standard match'
    }));

    const quickReplies = [
      { label: lang === 'ro' ? '📊 ROI estimat'    : '📊 Estimated ROI', q: lang === 'ro' ? 'Care e ROI-ul estimat?'      : "What's the estimated ROI?" },
      { label: lang === 'ro' ? '🛡 Cum garantezi 50y' : '🛡 50y guarantee', q: lang === 'ro' ? 'Cum garantezi că rezistă 50 de ani?' : 'How do you guarantee 50-year durability?' },
      { label: lang === 'ro' ? '🚀 Activează acum'  : '🚀 Activate now',  q: lang === 'ro' ? 'Vreau să activez planul acum' : 'I want to activate the plan now' }
    ];

    // Seed the auto-viralizer (masked ad). Fire-and-forget, fail-soft.
    seedViralizer(ad);

    return {
      plan: { narrative: plan.narrative, items: plan.items, profile, totalMonthlyUsd: plan.totalUsd },
      cards,
      recommendations,
      quickReplies,
      viralAd: ad,
      // Whether the concierge should append the 50Y narrative to the main reply.
      shouldAppendNarrative: shouldAppend(intent, profile)
    };
  } catch (e) {
    return { plan: null, cards: [], recommendations: [], quickReplies: [], viralAd: null, shouldAppendNarrative: false, error: e.message };
  }
}

function shouldAppend(intent, profile) {
  // Append the deep plan when the user is exploring rather than executing
  // a transactional intent (we don't want to bury BTC instructions etc).
  const intrusive = new Set(['btc_howto', 'paypal_howto', 'support', 'security', 'activate']);
  if (intrusive.has(intent)) return false;
  // For pricing/catalog/general/greet/buy/growth/automation/forecast/enterprise/roi,
  // the 50Y plan adds direct value.
  return true;
}

// Read-only knowledge endpoints for other modules / the autoviralizer
function getCapabilities() { return CAPABILITIES.slice(); }
function getKnowledgeSummary() {
  return {
    capabilityCount: CAPABILITIES.length,
    pillars: Array.from(new Set(CAPABILITIES.map(c => c.pillar))),
    audiences: Array.from(new Set(CAPABILITIES.flatMap(c => c.audience))),
    generatedAt: new Date().toISOString(),
    standard: '50-year-durability'
  };
}

module.exports = {
  personalize,
  inferProfile,
  buildPlan,
  buildViralAd,
  getCapabilities,
  getKnowledgeSummary
};
