'use strict';

/**
 * Autonomous Enterprise Deal Orchestrator (AEDO/1.0)
 * --------------------------------------------------
 * Superlative autonomous deal brain for ZeusAI / Unicorn:
 *   • Rail classification (Instant / Professional / Enterprise)
 *   • Dynamic ACV (low / mid / high) with component breakdown
 *   • Kickoff = 5–10% of ACV, clamped [$1,000 … $25,000]
 *   • Autonomous negotiation close (no human OTP)
 *   • Full proposal pack (MSA, SOW, Tech, Security, Timeline, Payments)
 *   • Autonomous onboarding trigger
 *
 * Honesty: full ACV is never claimed as instant digital delivery.
 * Cash closes via proportional kickoff; remainder under SOW milestones.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'AEDO/1.0';
const KICKOFF_ID = 'ent-engagement-kickoff';
const KICKOFF_MIN = 1000;
const KICKOFF_MAX = 25000;
const KICKOFF_PCT_MIN = 0.05;
const KICKOFF_PCT_MAX = 0.10;

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR
  || path.join(__dirname, '..', '..', 'data', 'commerce');
const LEDGER = path.join(DATA_DIR, 'aedo-orchestrator.jsonl');
const ONBOARD_LEDGER = path.join(DATA_DIR, 'aedo-onboarding.jsonl');

function _ensure() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

function _append(file, row) {
  _ensure();
  try {
    fs.appendFileSync(file, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, row)) + '\n');
  } catch (_) {}
}

function _fmt(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function _catalog() {
  try { return require('./enterprise-catalog'); } catch (_) { return null; }
}

function _pack() {
  try { return require('./enterprise-proposal-pack'); } catch (_) { return null; }
}

function _negotiator() {
  try { return require('./negotiation-engine'); } catch (_) { return null; }
}

function _aecos() {
  try { return require('./autonomous-enterprise-closure-os'); } catch (_) { return null; }
}

function _desk() {
  try { return require('../../backend/modules/enterprise-deal-desk'); } catch (_) { return null; }
}

/* ───────────────────────── Rails ───────────────────────── */

function rails() {
  return [
    {
      id: 'instant',
      title: 'Instant',
      cta: 'Buy → Pay',
      acvRange: 'ACV < $10,000',
      meaning: 'Self-serve digital delivery. Fully autonomous. No negotiation. Basic ToS only.',
    },
    {
      id: 'professional',
      title: 'Professional',
      cta: 'Reserve → Pay',
      acvRange: 'ACV $10,000–$50,000',
      meaning: 'AI-assisted kickoff. Semi-custom delivery. Light SOW. Limited negotiation.',
    },
    {
      id: 'enterprise',
      title: 'Enterprise',
      cta: 'Start Autonomous Deal',
      acvRange: 'ACV > $50,000',
      meaning: 'Full AI negotiation. Proportional kickoff (5–10% ACV). MSA + SOW + security pack. Autonomous onboarding.',
    },
  ];
}

/**
 * Detect rail from ACV / signals / product.
 * @returns {{ rail, cta, reason, reasons: string[] }}
 */
function detectRail(input) {
  const o = input || {};
  const acv = Number(o.acvUsd || o.acv || o.priceUSD || o.budget || 0) || 0;
  const text = String(o.message || o.intent || o.notes || '').toLowerCase();
  const productId = String(o.productId || o.id || '');
  const reasons = [];

  const enterpriseSignals = [
    /procurement|legal review|security review|compliance|soc\s*2|iso\s*27001|hipaa|gdpr|msa|sow/,
    /multi[- ]?year|multi[- ]?region|multi[- ]?team|fortune|hyperscaler|enterprise/,
    /on[- ]?prem|private cloud|dedicated|sso|saml/,
  ];
  const hasEntSignal = enterpriseSignals.some((re) => re.test(text))
    || /^ent-/i.test(productId)
    || String(o.tier || o.group || '').toLowerCase() === 'enterprise'
    || o.enterprise === true;

  if (acv > 50000 || (hasEntSignal && acv >= 25000) || (hasEntSignal && !acv && /^ent-/i.test(productId))) {
    if (acv > 50000) reasons.push('ACV > $50,000');
    if (hasEntSignal) reasons.push('Enterprise procurement / security / multi-team signals');
    if (/^ent-/i.test(productId)) reasons.push('Enterprise catalog product ' + productId);
    return {
      rail: 'enterprise',
      cta: 'Start Autonomous Deal',
      reason: reasons.join('; ') || 'Enterprise engagement',
      reasons,
    };
  }

  if (acv >= 10000 || String(o.tier || '').toLowerCase() === 'professional' || /^professional-/i.test(productId)) {
    if (acv >= 10000) reasons.push('ACV $10k–$50k');
    else reasons.push('Professional product / customization');
    return {
      rail: 'professional',
      cta: 'Reserve → Pay',
      reason: reasons.join('; '),
      reasons,
    };
  }

  reasons.push(acv > 0 ? 'ACV < $10,000' : 'Standard self-serve digital product');
  return {
    rail: 'instant',
    cta: 'Buy → Pay',
    reason: reasons.join('; '),
    reasons,
  };
}

/* ───────────────────────── ACV engine ───────────────────────── */

/**
 * Dynamic ACV calculation with component breakdown.
 */
function computeAcv(input) {
  const o = input || {};
  const cat = _catalog();
  const product = (o.productId && cat && cat.byId(o.productId)) || o.product || null;
  const list = Number((product && product.priceUSD) || o.baseUsd || o.listPriceUSD || 0) || 0;

  const seats = Math.max(1, Math.min(5000, Number(o.seats) || Number(o.volume) || 25));
  const termYears = Math.max(1, Math.min(10, Number(o.termYears) || 1));
  const slaTier = String(o.slaTier || 'enterprise').toLowerCase();
  const slaUplift = slaTier === 'mission' ? 1.5 : (slaTier === 'premium' || slaTier === 'enterprise' ? 1.25 : 1.0);

  const integrations = Array.isArray(o.integrations) ? o.integrations : String(o.integrations || '')
    .split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const integrationOneTime = integrations.length * 15000;
  const integrationRecurring = integrations.length * 5000;

  const compliance = Array.isArray(o.compliance) ? o.compliance : String(o.compliance || '')
    .split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const complianceUplift = 1 + Math.min(0.35, compliance.length * 0.07);

  // Seat curve: first 25 included in base; beyond that logarithmic.
  const seatFactor = seats <= 25 ? 1 : (1 + Math.log10(seats / 25 + 1) * 0.55);

  const baseAnnual = list > 0 ? list : 120000;
  const components = {
    baseLicenseUsd: Math.round(baseAnnual),
    seatFactor: +seatFactor.toFixed(3),
    seats,
    slaTier,
    slaUplift,
    integrationOneTimeUsd: integrationOneTime,
    integrationRecurringUsd: integrationRecurring,
    compliance,
    complianceUplift: +complianceUplift.toFixed(3),
    termYears,
  };

  const mid = Math.round(
    (baseAnnual * seatFactor * slaUplift * complianceUplift + integrationRecurring) * termYears
    + integrationOneTime
  );
  const low = Math.round(mid * 0.85);
  const high = Math.round(mid * 1.18);

  return {
    low,
    mid,
    high,
    accepted: Number(o.acceptedPriceUSD) || mid,
    currency: 'USD',
    components,
    breakdown: [
      { item: 'Base platform / license', usd: components.baseLicenseUsd },
      { item: 'Seat / volume factor ×' + components.seatFactor, usd: Math.round(baseAnnual * (seatFactor - 1)) },
      { item: 'SLA uplift (' + slaTier + ' ×' + slaUplift + ')', usd: Math.round(baseAnnual * seatFactor * (slaUplift - 1)) },
      { item: 'Compliance overlay', usd: Math.round(baseAnnual * seatFactor * slaUplift * (complianceUplift - 1)) },
      { item: 'Integrations (one-time)', usd: integrationOneTime },
      { item: 'Integrations (annual)', usd: integrationRecurring * termYears },
      { item: 'Term multiplier (' + termYears + 'y)', usd: 0 },
    ],
    justification: 'ACV derived from catalog list, seats, SLA, compliance overlays, and integration scope. Mid case is the commercial anchor.',
  };
}

/* ───────────────────────── Kickoff fee ───────────────────────── */

/**
 * Kickoff = 5–10% of estimated ACV, clamped [$1k, $25k].
 */
function computeKickoff(acvOrInput, opts) {
  const o = opts || {};
  let acvMid = 0;
  if (typeof acvOrInput === 'number') acvMid = acvOrInput;
  else if (acvOrInput && typeof acvOrInput === 'object') {
    acvMid = Number(acvOrInput.mid || acvOrInput.accepted || acvOrInput.acvUsd || 0) || 0;
  }

  const complexity = Math.max(0, Math.min(1, Number(o.complexity) || _complexityScore(o)));
  const risk = Math.max(0, Math.min(1, Number(o.risk) || _riskScore(o)));
  const strategic = Math.max(0, Math.min(1, Number(o.strategic) || 0));

  // Higher complexity/risk → closer to 10%; strategic importance → toward 5–7%.
  let pct = KICKOFF_PCT_MIN + (KICKOFF_PCT_MAX - KICKOFF_PCT_MIN) * (0.55 * complexity + 0.45 * risk);
  if (strategic >= 0.7) pct = Math.min(pct, 0.07);
  pct = Math.max(KICKOFF_PCT_MIN, Math.min(KICKOFF_PCT_MAX, +pct.toFixed(4)));

  const raw = Math.round(acvMid * pct);
  const fee = Math.max(KICKOFF_MIN, Math.min(KICKOFF_MAX, raw || KICKOFF_MIN));

  return {
    kickoffUsd: fee,
    percentage: pct,
    percentageLabel: (pct * 100).toFixed(1) + '%',
    acvUsd: acvMid,
    bounds: { min: KICKOFF_MIN, max: KICKOFF_MAX, pctMin: KICKOFF_PCT_MIN, pctMax: KICKOFF_PCT_MAX },
    factors: { complexity, risk, strategic },
    justification: [
      'Kickoff = ' + (pct * 100).toFixed(1) + '% of estimated ACV ' + _fmt(acvMid),
      'Clamped to [' + _fmt(KICKOFF_MIN) + ' … ' + _fmt(KICKOFF_MAX) + ']',
      'Complexity=' + complexity.toFixed(2) + ' · Risk=' + risk.toFixed(2)
        + (strategic ? (' · Strategic=' + strategic.toFixed(2)) : ''),
      'Kickoff unlocks MSA/SOW/security pack and funds discovery — not full license delivery',
    ].join('. '),
  };
}

function _complexityScore(o) {
  let s = 0.4;
  const ints = Array.isArray(o.integrations) ? o.integrations.length : 0;
  s += Math.min(0.35, ints * 0.08);
  if (String(o.slaTier || '').toLowerCase() === 'mission') s += 0.15;
  if (Number(o.seats) > 200) s += 0.1;
  return Math.min(1, s);
}

function _riskScore(o) {
  let s = 0.35;
  const comp = Array.isArray(o.compliance) ? o.compliance.length : 0;
  s += Math.min(0.4, comp * 0.1);
  if (/hipaa|gov|sovereign|on-?prem/i.test(String(o.message || o.notes || ''))) s += 0.2;
  return Math.min(1, s);
}

/* ───────────────────────── Offer + packages ───────────────────────── */

function proposeOffer(input) {
  const o = input || {};
  const rail = detectRail(o);
  const acv = computeAcv(o);
  const kick = computeKickoff(acv, o);
  const termYears = Number(o.termYears) || acv.components.termYears || 1;

  const packages = [
    {
      id: 'base',
      title: 'Base Enterprise',
      acvUsd: acv.low,
      kickoffUsd: computeKickoff(acv.low, o).kickoffUsd,
      includes: ['Core platform license', 'Standard SLA', 'Email support', 'Basic integrations (≤2)'],
    },
    {
      id: 'premium',
      title: 'Premium Enterprise',
      acvUsd: acv.mid,
      kickoffUsd: kick.kickoffUsd,
      recommended: true,
      includes: ['Full platform', 'Enterprise SLA', 'Priority support', 'Integrations as scoped', 'Security pack'],
    },
    {
      id: 'enterprise-plus',
      title: 'Enterprise+',
      acvUsd: acv.high,
      kickoffUsd: computeKickoff(acv.high, Object.assign({}, o, { complexity: 0.9, risk: 0.85 })).kickoffUsd,
      includes: ['Everything in Premium', 'Mission-critical SLA option', 'Dedicated success path', 'Advanced compliance overlays', 'Multi-region readiness'],
    },
  ];

  return {
    protocol: PROTOCOL,
    rail,
    acv,
    kickoff: kick,
    termYears,
    packages,
    value: {
      roi: 'Automation + autonomous commerce typically recovers ACV within 1–3 operational cycles for mid-market and faster for hyperscale ops.',
      tco: 'TCO includes kickoff + milestone schedule; BTC rail reduces FX and processor leakage vs card-only stacks.',
      whyOptimal: 'Premium (mid ACV) balances scope certainty with margin-safe delivery. Kickoff proportional to ACV aligns incentives without over-collecting.',
    },
    next: rail.rail === 'enterprise'
      ? [
        'Accept Premium commercial terms (or counter)',
        'Pay kickoff ' + _fmt(kick.kickoffUsd) + ' to unlock proposal pack',
        'Review MSA / SOW / Security Pack',
        'Autonomous onboarding starts after kickoff + pack acknowledgment',
      ]
      : ['Follow ' + rail.cta + ' on the selected rail'],
  };
}

/* ───────────────────────── Kickoff quote (dynamic) ───────────────────────── */

function buildKickoffQuote(input) {
  const o = input || {};
  const email = String(o.email || '').trim().toLowerCase();
  const acv = o.acv || computeAcv(o);
  const kick = o.kickoff || computeKickoff(acv, o);
  const fee = kick.kickoffUsd;
  const desk = _desk();
  const spot = Math.max(1, Number(o.btcSpotUsd) || Number(process.env.BTC_SPOT_USD) || 95000);
  const wallet = o.btcWallet || process.env.LEGAL_OWNER_BTC || process.env.BTC_WALLET_ADDRESS
    || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

  let quoteId = 'quote_aedo_' + crypto.randomBytes(4).toString('hex');
  let orderId = null;

  if (desk && typeof desk.buildQuote === 'function') {
    try {
      const q = desk.buildQuote({
        items: [{ id: KICKOFF_ID, title: 'Enterprise Engagement Kickoff', priceUsd: fee }],
        seats: 1,
        slaTier: 'standard',
        customerId: email || null,
        discountPct: 0,
        btcWallet: wallet,
        btcSpotUsd: spot,
      });
      quoteId = q.id || quoteId;
      orderId = q.orderId || null;
    } catch (_) { /* pin locally */ }
  }

  const btcAmount = +(fee / spot).toFixed(8);
  const btcUri = wallet
    ? ('bitcoin:' + wallet + '?amount=' + btcAmount.toFixed(8) + '&label=' + encodeURIComponent('ZeusAI-' + quoteId))
    : null;
  const checkoutHref = '/checkout/?plan=' + encodeURIComponent(KICKOFF_ID)
    + (email ? ('&email=' + encodeURIComponent(email)) : '')
    + '&amountUsd=' + encodeURIComponent(String(fee))
    + '&quoteId=' + encodeURIComponent(quoteId);

  return {
    id: quoteId,
    productId: KICKOFF_ID,
    netUsd: fee,
    btcAmount,
    btcAddress: wallet,
    btcUri,
    checkoutHref,
    orderId,
    kickoff: kick,
    acv,
    honesty: 'Proportional kickoff (' + kick.percentageLabel + ' of ACV, clamped). Full ACV closes under SOW milestones — not instant delivery.',
  };
}

/* ───────────────────────── Autonomous close ───────────────────────── */

function closeFromContact(lead, opts) {
  const o = opts || {};
  const email = String((lead && lead.email) || o.email || '').trim().toLowerCase();
  const interest = String((lead && lead.interest) || o.productId || 'ent-platform-license');
  const requirements = Object.assign({
    seats: o.seats || 25,
    slaTier: o.slaTier || 'enterprise',
    integrations: o.integrations || [],
    compliance: o.compliance || [],
    message: (lead && lead.message) || o.message || '',
  }, o.requirements || {});

  const offer = proposeOffer(Object.assign({
    productId: interest,
    email,
    message: requirements.message,
  }, requirements));

  const quote = buildKickoffQuote({
    email,
    productId: interest,
    acv: offer.acv,
    kickoff: offer.kickoff,
    btcWallet: o.btcWallet,
    btcSpotUsd: o.btcSpotUsd,
  });

  const out = {
    protocol: PROTOCOL,
    leadId: lead && lead.id,
    email,
    interest,
    rail: offer.rail,
    offer,
    quote,
    next: offer.next,
    message: 'Autonomous Enterprise Deal Orchestrator ready — rail '
      + offer.rail.rail.toUpperCase() + '. Pay kickoff ' + _fmt(quote.netUsd)
      + ' to unlock MSA/SOW/security pack. Full ACV ' + _fmt(offer.acv.mid) + ' closes under SOW.',
    messageRo: 'Orchestratorul autonom e gata — rail '
      + offer.rail.rail + '. Plătește kickoff ' + _fmt(quote.netUsd)
      + ' pentru pachetul MSA/SOW. ACV ' + _fmt(offer.acv.mid) + ' se închide pe SOW.',
  };
  _append(LEDGER, { type: 'contact_close', leadId: out.leadId, quoteId: quote.id, kickoffUsd: quote.netUsd, acv: offer.acv.mid, rail: offer.rail.rail });
  return out;
}

/**
 * Accept deal autonomously: skip human OTP, confirm, mint kickoff, generate pack, onboard.
 */
function closeFromDeal(deal, opts) {
  const o = opts || {};
  const neg = _negotiator();
  let d = deal || {};

  // Autonomous confirm — no human governance.
  if (neg && d.id && d.state !== 'confirmed') {
    try {
      if (d.state !== 'pending_governance' && typeof neg.accept === 'function') {
        d = neg.accept(d.id);
      }
      if (typeof neg.confirmAutonomous === 'function') {
        d = neg.confirmAutonomous(d.id);
      } else if (typeof neg.confirmGovernance === 'function' && typeof neg._peekOtp === 'function') {
        const otp = neg._peekOtp(d.id);
        if (otp) d = neg.confirmGovernance(d.id, otp);
      }
    } catch (e) {
      _append(LEDGER, { type: 'auto_confirm_warn', dealId: d.id, error: e.message });
    }
  }

  const requirements = Object.assign({
    seats: o.seats || 25,
    slaTier: o.slaTier || 'enterprise',
    integrations: o.integrations || [],
    compliance: o.compliance || [],
    termYears: d.termYears || o.termYears || 1,
  }, o.requirements || {});

  const acv = computeAcv(Object.assign({
    productId: d.productId,
    acceptedPriceUSD: d.acceptedPriceUSD || d.counterOfferUSD || d.listPriceUSD,
    listPriceUSD: d.listPriceUSD,
  }, requirements));
  acv.accepted = Number(d.acceptedPriceUSD || acv.mid);

  const kick = computeKickoff(acv, requirements);
  const quote = buildKickoffQuote({
    email: d.buyer && d.buyer.email,
    productId: d.productId,
    acv,
    kickoff: kick,
    btcWallet: o.btcWallet,
    btcSpotUsd: o.btcSpotUsd,
  });

  const cat = _catalog();
  const product = (cat && cat.byId(d.productId)) || { id: d.productId, title: d.productTitle };
  const packMod = _pack();
  let pack = null;
  if (packMod && typeof packMod.generatePack === 'function') {
    pack = packMod.generatePack({
      dealId: d.id,
      buyer: d.buyer,
      product,
      requirements,
      acv,
      kickoffUsd: kick.kickoffUsd,
      termYears: requirements.termYears,
      timelineWeeks: Number(o.timelineWeeks) || Math.max(8, Math.min(26, Math.round(acv.mid / 50000) * 4 + 8)),
    });
  }

  const onboarding = triggerOnboarding({
    deal: d,
    pack,
    kickoff: kick,
    acv,
    email: d.buyer && d.buyer.email,
  });

  const out = {
    protocol: PROTOCOL,
    dealId: d.id,
    state: d.state,
    acceptedPriceUSD: acv.accepted,
    kickoff: quote,
    pack,
    onboarding,
    honesty: 'Deal ACV recorded for SOW. Payable now = proportional kickoff only. Pack generated autonomously — no human approval.',
    checkoutHref: quote.checkoutHref,
    contractId: d.contractId || null,
    contractUrl: d.contractUrl || null,
  };
  _append(LEDGER, {
    type: 'deal_close',
    dealId: d.id,
    quoteId: quote.id,
    kickoffUsd: quote.netUsd,
    acv: acv.accepted,
    packId: pack && pack.packId,
    onboardingId: onboarding && onboarding.id,
  });
  return out;
}

/* ───────────────────────── Onboarding ───────────────────────── */

function triggerOnboarding(input) {
  const o = input || {};
  const id = 'onboard_' + crypto.randomBytes(5).toString('hex');
  const email = String(o.email || (o.deal && o.deal.buyer && o.deal.buyer.email) || '').toLowerCase();
  const steps = [
    { key: 'tenant', title: 'Provision enterprise tenant namespace', status: 'queued' },
    { key: 'admin', title: 'Create admin access for ' + (email || 'sponsor'), status: 'queued' },
    { key: 'pack', title: 'Attach proposal pack ' + ((o.pack && o.pack.packId) || '—'), status: 'queued' },
    { key: 'integrations', title: 'Schedule integration discovery', status: 'queued' },
    { key: 'monitoring', title: 'Enable SLA / heartbeat monitoring', status: 'queued' },
    { key: 'kickoff_pay', title: 'Await kickoff payment confirmation', status: 'pending_payment' },
  ];

  // Best-effort: call provisioning-engine if present.
  let provision = null;
  try {
    const pe = require('../../backend/modules/provisioning-engine');
    if (pe && typeof pe.provisionTenant === 'function') {
      const tenantId = 'ent_' + crypto.randomBytes(4).toString('hex');
      provision = pe.provisionTenant(tenantId, 'enterprise');
      steps[0].status = 'started';
      steps[0].tenantId = tenantId;
    }
  } catch (_) { /* optional */ }

  // Portal customer bootstrap.
  try {
    const portal = require('./customer-portal');
    if (portal && email && typeof portal.ensureCustomer === 'function') {
      portal.ensureCustomer({ email, name: o.deal && o.deal.buyer && o.deal.buyer.contactName });
      steps[1].status = 'started';
    } else if (portal && email && typeof portal.createCustomer === 'function') {
      portal.createCustomer({ email });
      steps[1].status = 'started';
    }
  } catch (_) { /* optional */ }

  const plan = {
    id,
    protocol: PROTOCOL,
    email,
    dealId: o.deal && o.deal.id,
    packId: o.pack && o.pack.packId,
    kickoffUsd: o.kickoff && o.kickoff.kickoffUsd,
    acvUsd: o.acv && (o.acv.accepted || o.acv.mid),
    steps,
    provision,
    firstSteps: [
      'Pay kickoff via checkout link',
      'Download MSA / SOW / Security Pack from /api/enterprise/pack/' + ((o.pack && o.pack.packId) || '{packId}'),
      'Nominate commercial + technical sponsors',
      'Complete discovery questionnaire (auto-sent)',
    ],
    support: {
      email: process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com',
      channel: 'Autonomous desk · /enterprise#enterprise-contact',
    },
    status: 'awaiting_kickoff_payment',
    createdAt: new Date().toISOString(),
  };
  _append(ONBOARD_LEDGER, { type: 'onboarding', id, dealId: plan.dealId, packId: plan.packId, email });
  return plan;
}

/* ───────────────────────── Public status / orchestrate ───────────────────────── */

function orchestrate(input) {
  const o = input || {};
  const offer = proposeOffer(o);
  if (offer.rail.rail !== 'enterprise') {
    return {
      protocol: PROTOCOL,
      ok: true,
      rail: offer.rail,
      offer,
      message: 'Classified as ' + offer.rail.rail.toUpperCase() + ' — use CTA "' + offer.rail.cta + '". '
        + offer.rail.reason,
    };
  }
  const quote = buildKickoffQuote(Object.assign({}, o, { acv: offer.acv, kickoff: offer.kickoff }));
  return {
    protocol: PROTOCOL,
    ok: true,
    rail: offer.rail,
    offer,
    quote,
    message: offer.rail.reason,
    next: offer.next,
  };
}

function publicStatus() {
  return {
    ok: true,
    protocol: PROTOCOL,
    rails: rails(),
    kickoffPolicy: {
      pctMin: KICKOFF_PCT_MIN,
      pctMax: KICKOFF_PCT_MAX,
      minUsd: KICKOFF_MIN,
      maxUsd: KICKOFF_MAX,
      formula: 'clamp(ACV × 5–10%, $1,000, $25,000)',
    },
    documents: ['MSA', 'SOW', 'Technical Appendix', 'Security & Compliance Pack', 'Timeline & Milestones', 'Payment Schedule'],
    autonomy: {
      negotiation: true,
      humanApprovalRequired: false,
      proposalPack: true,
      onboarding: true,
    },
    honesty: [
      'Full enterprise ACV is never self-serve “Buy = delivered”.',
      'Kickoff is proportional to ACV (5–10%, bounded).',
      'MSA/SOW/security pack generated autonomously after commercial acceptance.',
      'Remainder settles on milestone Payment Schedule.',
    ],
  };
}

module.exports = {
  PROTOCOL,
  KICKOFF_ID,
  KICKOFF_MIN,
  KICKOFF_MAX,
  KICKOFF_PCT_MIN,
  KICKOFF_PCT_MAX,
  rails,
  detectRail,
  computeAcv,
  computeKickoff,
  proposeOffer,
  buildKickoffQuote,
  closeFromContact,
  closeFromDeal,
  triggerOnboarding,
  orchestrate,
  publicStatus,
};
