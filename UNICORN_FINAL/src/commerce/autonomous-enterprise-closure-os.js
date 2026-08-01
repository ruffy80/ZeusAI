'use strict';

/**
 * Autonomous Enterprise Closure OS (AECOS/1.0)
 * --------------------------------------------
 * Financial decision (locked):
 *   • Full enterprise ACV stays SOW / proposal — never fake self-serve delivery.
 *   • Profit closes via an honest, buyable ENGAGEMENT KICKOFF deposit that
 *     funds discovery + signed proposal pack (fulfillment-engine ENTERPRISE_RECIPE).
 *   • Negotiation → counter → accept → kickoff invoice runs autonomously.
 *
 * Rails (UX clarity):
 *   Instant  → Buy self-serve
 *   Pro      → Reserve kickoff
 *   Enterprise → Start autonomous deal → Pay kickoff → SOW remainder
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'AECOS/1.0';
const KICKOFF_ID = 'ent-engagement-kickoff';
/** Default / floor display price — dynamic kickoff comes from AEDO (5–10% ACV). */
const KICKOFF_PRICE_USD = 2500;

function _aedo() {
  try { return require('./autonomous-enterprise-deal-orchestrator'); } catch (_) { return null; }
}

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR
  || path.join(__dirname, '..', '..', 'data', 'commerce');
const LEDGER = path.join(DATA_DIR, 'aecos-closure.jsonl');

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

function _append(row) {
  _ensureDir();
  try {
    fs.appendFileSync(LEDGER, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, row)) + '\n');
  } catch (_) {}
}

function _desk() {
  try { return require('../../backend/modules/enterprise-deal-desk'); } catch (_) { return null; }
}

function _catalog() {
  try { return require('./enterprise-catalog'); } catch (_) { return null; }
}

function _fmtUsd(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function kickoffSku() {
  return {
    id: KICKOFF_ID,
    title: 'Enterprise Engagement Kickoff',
    tier: 'enterprise',
    group: 'enterprise-kickoff',
    priceUSD: KICKOFF_PRICE_USD,
    billing: 'one-time',
    currency: 'USD',
    buyableMode: 'reserve',
    description: 'Autonomous kickoff deposit: discovery call prep, signed engagement proposal pack, milestone SOW draft, and deal-desk BTC invoice for the remainder. Does NOT deliver the full enterprise license — that closes after SOW acceptance.',
    sla: 'proposal pack ≤ 24h after payment',
    honesty: 'Kickoff funds real work. Full ACV stays proposal/SOW.',
  };
}

function rails() {
  const aedo = _aedo();
  if (aedo && typeof aedo.rails === 'function') return aedo.rails();
  return [
    {
      id: 'instant',
      title: 'Instant',
      cta: 'Buy → Pay',
      meaning: 'Self-serve digital delivery. Fully autonomous. No negotiation.',
    },
    {
      id: 'professional',
      title: 'Professional',
      cta: 'Reserve → Pay',
      meaning: 'AI-assisted kickoff. Semi-custom delivery. Light SOW.',
    },
    {
      id: 'enterprise',
      title: 'Enterprise',
      cta: 'Start Autonomous Deal',
      meaning: 'Full AI negotiation. Kickoff = 5–10% of ACV ($1k–$25k). MSA + SOW + security pack. Autonomous onboarding.',
    },
  ];
}

function enrichProductForUi(p) {
  if (!p || typeof p !== 'object') return null;
  const price = Number(p.priceUSD || p.price || 0) || 0;
  const isKickoff = p.id === KICKOFF_ID || p.group === 'enterprise-kickoff';
  return {
    id: p.id,
    title: p.title,
    tier: isKickoff ? 'kickoff' : (p.tier || 'enterprise'),
    segment: isKickoff ? 'Engagement deposit' : 'Enterprise SOW',
    tagline: p.description || '',
    description: p.description || '',
    priceUSD: price,
    floorFmt: _fmtUsd(Math.round(price * 0.7)),
    anchorFmt: _fmtUsd(price),
    topstoneFmt: _fmtUsd(Math.round(price * 1.15)),
    model: p.billing || 'proposal',
    valueCaptured: p.sla || (isKickoff ? 'Signed proposal pack + kickoff invoice' : 'SOW + milestone delivery'),
    accounts: isKickoff
      ? ['Any enterprise buyer', 'Fortune 500', 'Scale-ups']
      : ['Hyperscalers', 'Fortune 500', 'Sovereign / gov'],
    sla: p.sla || null,
    buyableMode: isKickoff ? 'reserve' : 'contact',
    ctaLabel: isKickoff ? 'Pay engagement kickoff →' : 'Start autonomous deal →',
    ctaHref: isKickoff
      ? ('/checkout/?plan=' + encodeURIComponent(KICKOFF_ID))
      : '/enterprise#enterprise-contact',
    honesty: isKickoff
      ? 'Pays for discovery + proposal pack. Full ACV still SOW.'
      : 'Not self-serve full delivery. Autonomous desk opens kickoff + SOW path.',
  };
}

function enrichDealForUi(deal) {
  if (!deal) return null;
  const statusMap = {
    open: 'open',
    countered: 'open',
    pending_governance: 'pending_governance',
    confirmed: 'closed_won',
    rejected: 'closed_lost',
  };
  const history = Array.isArray(deal.history) ? deal.history : [];
  const buyer = deal.buyer || {};
  const buyerOffers = history.filter((h) => h.actor === 'buyer' && (h.offerUSD != null || h.priceUSD != null));
  const lastBuyer = buyerOffers.length ? buyerOffers[buyerOffers.length - 1] : null;
  const lastBuyerUsd = lastBuyer
    ? (lastBuyer.offerUSD != null ? lastBuyer.offerUSD : lastBuyer.priceUSD)
    : null;
  const round = Math.max(1, history.filter((h) => h.actor === 'buyer').length);
  const status = statusMap[deal.state] || deal.state || 'open';
  const uiOpen = status === 'open' || status === 'countered';
  return Object.assign({}, deal, {
    status,
    buyerName: buyer.legalEntity || buyer.contactName || buyer.email || deal.buyerName || 'Prospect',
    buyerTier: deal.buyerTier || buyer.tier || 'fortune500',
    termYears: deal.termYears != null ? deal.termYears : 5,
    round,
    maxRounds: deal.maxRounds || 8,
    currentOfferFmt: _fmtUsd(deal.counterOfferUSD || deal.currentOfferUSD || deal.listPriceUSD || 0),
    lastBuyerOfferFmt: lastBuyerUsd != null ? _fmtUsd(lastBuyerUsd) : '—',
    counterOfferFmt: deal.counterOfferUSD != null ? _fmtUsd(deal.counterOfferUSD) : '—',
    listFmt: _fmtUsd(deal.listPriceUSD || 0),
    anchorFmt: _fmtUsd(deal.listPriceUSD || 0),
    acceptedFmt: deal.acceptedPriceUSD != null ? _fmtUsd(deal.acceptedPriceUSD) : null,
    closedPriceFmt: (status === 'closed_won' && deal.acceptedPriceUSD != null)
      ? _fmtUsd(deal.acceptedPriceUSD)
      : null,
    uiOpen,
    history: history.map((h, i) => ({
      round: i + 1,
      actor: (h.actor === 'buyer') ? 'buyer' : 'unicorn',
      type: h.action || h.type || 'update',
      priceUSD: h.offerUSD != null ? h.offerUSD : h.priceUSD,
      message: h.message || '',
      at: h.at,
    })),
  });
}

/**
 * Normalize SPA negotiate/start body → negotiation-engine startDeal input.
 */
function normalizeNegotiateStart(body) {
  const p = body && typeof body === 'object' ? body : {};
  const buyerIn = p.buyer && typeof p.buyer === 'object' ? p.buyer : {};
  const email = String(buyerIn.email || p.email || p.buyerEmail || '').trim().toLowerCase();
  const name = String(
    buyerIn.contactName || buyerIn.name || p.buyerName || p.name || ''
  ).trim();
  const legal = String(
    buyerIn.legalEntity || p.company || p.legalEntity || name || ''
  ).trim();
  const termYears = Math.max(1, Math.min(15, Number(p.termYears) || 5));
  const buyerTier = String(p.buyerTier || buyerIn.tier || 'fortune500');
  if (!email) {
    // Synthesize a stable placeholder only when UI sent a name without email
    // — engine requires email; SPA must collect it. Throw clear error.
    const err = new Error('buyer_email_required');
    err.code = 'buyer_email_required';
    throw err;
  }
  return {
    productId: String(p.productId || ''),
    buyer: {
      email,
      contactName: name || email.split('@')[0],
      legalEntity: legal || name || email,
      jurisdiction: String(buyerIn.jurisdiction || p.jurisdiction || ''),
      tier: buyerTier,
    },
    offerUSD: Number(p.offerUSD) || 0,
    message: String(p.message || ''),
    buyerTier,
    termYears,
  };
}

function pipelineStats(deals) {
  const list = Array.isArray(deals) ? deals : [];
  let booked = 0;
  let pipeline = 0;
  let open = 0;
  let won = 0;
  let lost = 0;
  for (const d of list) {
    const st = d.state || d.status;
    const price = Number(d.acceptedPriceUSD || d.counterOfferUSD || d.currentOfferUSD || d.listPriceUSD || 0) || 0;
    if (st === 'confirmed' || st === 'closed_won') {
      booked += Number(d.acceptedPriceUSD || price) || 0;
      won += 1;
    } else if (st === 'rejected' || st === 'closed_lost') {
      lost += 1;
    } else {
      open += 1;
      pipeline += price;
    }
  }
  const decided = won + lost;
  return {
    bookedFmt: _fmtUsd(booked),
    pipelineFmt: _fmtUsd(pipeline),
    open,
    winRate: decided ? Math.round((won / decided) * 100) : 0,
    won,
    lost,
    count: list.length,
  };
}

function enrichCatalogResponse() {
  const cat = _catalog();
  const products = cat && typeof cat.publicView === 'function' ? cat.publicView() : [];
  const enriched = products.map(enrichProductForUi).filter(Boolean);
  const summary = cat && typeof cat.summarize === 'function' ? cat.summarize() : { products: enriched.length };
  const total = enriched.reduce((s, p) => s + (Number(p.priceUSD) || 0), 0);
  return {
    updatedAt: new Date().toISOString(),
    summary: Object.assign({}, summary, {
      addressableAccounts: 'Hyperscalers · F500 · Sovereign',
      anchorPortfolioFmt: _fmtUsd(total),
      topstonePortfolioFmt: _fmtUsd(Math.round(total * 1.15)),
    }),
    products: enriched,
    rails: rails(),
    kickoff: kickoffSku(),
    protocol: PROTOCOL,
  };
}

function buildKickoffQuote(input) {
  // Prefer AEDO dynamic kickoff (5–10% ACV, clamped $1k–$25k).
  const aedo = _aedo();
  if (aedo && typeof aedo.buildKickoffQuote === 'function') {
    return aedo.buildKickoffQuote(input || {});
  }

  const desk = _desk();
  const email = String((input && input.email) || '').trim().toLowerCase();
  const productId = String((input && input.productId) || KICKOFF_ID);
  const cat = _catalog();
  const product = (cat && cat.byId(productId)) || null;
  const title = (product && product.title) || 'Enterprise Engagement Kickoff';

  if (!desk || typeof desk.buildQuote !== 'function') {
    const id = 'quote_aecos_' + crypto.randomBytes(4).toString('hex');
    return {
      id,
      netUsd: KICKOFF_PRICE_USD,
      btcAmount: null,
      btcUri: null,
      checkoutHref: '/checkout/?plan=' + encodeURIComponent(KICKOFF_ID)
        + (email ? ('&email=' + encodeURIComponent(email)) : ''),
      productId: KICKOFF_ID,
      honesty: kickoffSku().honesty,
    };
  }

  const quote = desk.buildQuote({
    items: [{ id: KICKOFF_ID, title: 'Kickoff · ' + title, priceUsd: KICKOFF_PRICE_USD }],
    seats: 1,
    slaTier: 'standard',
    customerId: email || null,
    discountPct: 0,
    btcWallet: (input && input.btcWallet) || process.env.LEGAL_OWNER_BTC || process.env.BTC_WALLET_ADDRESS,
    btcSpotUsd: Number((input && input.btcSpotUsd) || process.env.BTC_SPOT_USD || 95000),
  });

  const checkoutHref = '/checkout/?plan=' + encodeURIComponent(KICKOFF_ID)
    + (email ? ('&email=' + encodeURIComponent(email)) : '')
    + (quote.id ? ('&quoteId=' + encodeURIComponent(quote.id)) : '');

  const netUsd = KICKOFF_PRICE_USD;
  const spot = Math.max(1, Number((input && input.btcSpotUsd) || process.env.BTC_SPOT_USD || 95000));
  const btcAmount = +(netUsd / spot).toFixed(8);
  const btcAddress = quote.btcAddress || process.env.LEGAL_OWNER_BTC || process.env.BTC_WALLET_ADDRESS;
  const btcUri = btcAddress
    ? ('bitcoin:' + btcAddress + '?amount=' + btcAmount.toFixed(8) + '&label=' + encodeURIComponent('ZeusAI-' + quote.id))
    : quote.btcUri;

  return {
    id: quote.id,
    netUsd,
    btcAmount,
    btcAddress,
    btcUri,
    seats: 1,
    slaTier: 'standard',
    orderId: quote.orderId || null,
    checkoutHref,
    productId: KICKOFF_ID,
    targetProductId: productId !== KICKOFF_ID ? productId : null,
    honesty: 'Kickoff deposit (AEDO fallback). Full enterprise ACV closes under SOW after proposal acceptance.',
  };
}

/**
 * Cap-coadă from contact form: lead → kickoff quote → pay CTA.
 */
function closeFromContact(lead, opts) {
  const aedo = _aedo();
  if (aedo && typeof aedo.closeFromContact === 'function') {
    const closure = aedo.closeFromContact(lead, opts);
    _append({ type: 'contact_close', leadId: closure.leadId, quoteId: closure.quote && closure.quote.id, netUsd: closure.quote && closure.quote.netUsd, via: 'aedo' });
    return Object.assign({ protocol: PROTOCOL }, closure);
  }
  const o = opts || {};
  const email = String((lead && lead.email) || o.email || '').trim().toLowerCase();
  const interest = String((lead && lead.interest) || o.productId || KICKOFF_ID);
  const quote = buildKickoffQuote({
    email,
    productId: interest,
    btcWallet: o.btcWallet,
    btcSpotUsd: o.btcSpotUsd,
  });
  const closure = {
    protocol: PROTOCOL,
    leadId: lead && lead.id,
    email,
    interest,
    quote,
    next: [
      'Pay engagement kickoff (BTC / PayPal / NOW when armed)',
      'Receive MSA / SOW / security pack automatically',
      'SOW remainder negotiated autonomously; full ACV never claimed as instant delivery',
    ],
    message: 'Autonomous desk ready — pay the engagement kickoff to start. Full license closes under SOW.',
    messageRo: 'Desk autonom gata — plătește kickoff-ul de engagement ca să pornim. Licența full se închide pe SOW.',
  };
  _append({ type: 'contact_close', leadId: closure.leadId, quoteId: quote.id, netUsd: quote.netUsd });
  return closure;
}

/**
 * After negotiate accept/confirm — mint kickoff path (not full ACV).
 */
function closeFromDeal(deal, opts) {
  const aedo = _aedo();
  if (aedo && typeof aedo.closeFromDeal === 'function') {
    const out = aedo.closeFromDeal(deal, opts);
    _append({
      type: 'deal_close',
      dealId: out.dealId,
      quoteId: out.kickoff && out.kickoff.id,
      acceptedPriceUSD: out.acceptedPriceUSD,
      packId: out.pack && out.pack.packId,
      via: 'aedo',
    });
    return Object.assign({ protocol: PROTOCOL }, out);
  }
  const d = deal || {};
  const email = String((d.buyer && d.buyer.email) || (opts && opts.email) || '').trim().toLowerCase();
  const quote = buildKickoffQuote({
    email,
    productId: d.productId || KICKOFF_ID,
    btcWallet: opts && opts.btcWallet,
    btcSpotUsd: opts && opts.btcSpotUsd,
  });
  const out = {
    protocol: PROTOCOL,
    dealId: d.id,
    acceptedPriceUSD: d.acceptedPriceUSD || d.counterOfferUSD || d.listPriceUSD,
    kickoff: quote,
    honesty: 'Deal ACV recorded for SOW. Payable now = engagement kickoff only.',
    checkoutHref: quote.checkoutHref,
  };
  _append({ type: 'deal_close', dealId: d.id, quoteId: quote.id, acceptedPriceUSD: out.acceptedPriceUSD });
  return out;
}

function publicStatus() {
  const cat = _catalog();
  const products = cat && typeof cat.publicView === 'function' ? cat.publicView() : [];
  return {
    ok: true,
    protocol: PROTOCOL,
    rails: rails(),
    kickoff: kickoffSku(),
    catalog: products.map(enrichProductForUi).filter(Boolean),
    summary: cat && typeof cat.summarize === 'function' ? cat.summarize() : { products: products.length },
    honesty: [
      'Full enterprise ACV is never self-serve “Buy = delivered”.',
      'Autonomous loop closes cash via engagement kickoff + proposal pack.',
      'Remainder of license/partnership settles under signed SOW.',
    ],
  };
}

module.exports = {
  PROTOCOL,
  KICKOFF_ID,
  KICKOFF_PRICE_USD,
  kickoffSku,
  rails,
  enrichProductForUi,
  enrichDealForUi,
  normalizeNegotiateStart,
  pipelineStats,
  enrichCatalogResponse,
  buildKickoffQuote,
  closeFromContact,
  closeFromDeal,
  publicStatus,
};
