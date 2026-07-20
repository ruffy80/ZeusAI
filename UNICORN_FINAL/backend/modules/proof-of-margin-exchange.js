// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// proof-of-margin-exchange.js — PoMX/1.0
// ---------------------------------------------------------------
// WORLD-FIRST PROTOCOL: Proof-of-Margin Exchange
//
// The world has catalogs, checkout, and crypto rails. Nobody has a
// machine-verifiable STANDARD that binds every sellable SKU to a
// cryptographically signed margin attestation (cost floor → retail →
// net margin % → settlement rail) that any agent can verify BEFORE
// buying — then emits an instant capability credential on settlement.
//
// PoMX spans the FULL ZeusAI multi-product surface (SaaS services,
// vertical packs, dropship desk/CJ SKUs) — not a single hero SKU.
// Take-rate on settlement: $0 (owner-wallet BTC). Honesty is the moat.
//
// RO: Bursa Mondială a Dovedii-de-Marjă — fiecare produs e atestat
// criptografic; agenții AI cumpără doar ce pot verifica.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NAME = 'proof-of-margin-exchange';
const PROTOCOL = 'PoMX/1.0';
const OWNER_BTC = process.env.BTC_OWNER_WALLET
  || process.env.BTC_WALLET_ADDRESS
  || process.env.OWNER_BTC_ADDRESS
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const PUBLIC_BASE = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://zeusai.pro').replace(/\/$/, '');

const state = {
  attestationsIssued: 0,
  quotesIssued: 0,
  ordersOpened: 0,
  settlementsAttested: 0,
  verifications: 0,
  lastExchangeAt: null,
  lastSettlementAt: null,
};

const _quotes = new Map(); // quoteId → quote
const _orders = new Map(); // orderId → order
const _settlements = new Map(); // settlementId → credential

function dataDir() {
  return process.env.POMX_DATA_DIR
    || path.join(process.env.UNICORN_COMMERCE_DIR || path.resolve(__dirname, '..', '..', 'data'), 'pomx');
}

function ensureDir() {
  try { fs.mkdirSync(dataDir(), { recursive: true }); } catch (_) {}
}

function isoNow(v) { return new Date(v || Date.now()).toISOString(); }

function sha256(input) {
  return crypto.createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');
}

function stableSort(input) {
  if (Array.isArray(input)) return input.map(stableSort);
  if (!input || typeof input !== 'object') return input;
  return Object.keys(input).sort().reduce((acc, k) => {
    acc[k] = stableSort(input[k]);
    return acc;
  }, {});
}

function stableStringify(input) {
  return JSON.stringify(stableSort(input));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function _envArmed(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) return false;
  return !/^(your|skip|changeme|todo|placeholder|xxx+|none|null|undefined|tbd|n\/a)/i.test(v);
}

// ── Signing (prefer forever-key / site-sign / WACP Ed25519, else HMAC) ──
function getSigningConfig() {
  // Prefer live forever-key PEM if shared into env or filesystem.
  const pemCandidates = [
    process.env.SITE_SIGN_PRIVATE_KEY,
    process.env.WACP_ED25519_PRIVATE_KEY,
  ].filter(Boolean);
  for (const pem of pemCandidates) {
    try {
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
      return { mode: 'ed25519', privateKey, publicKey, keyId };
    } catch (_) {}
  }
  // Shared forever-key on VPS
  try {
    const pemPath = process.env.SITE_SIGN_KEY_FILE
      || '/var/www/unicorn/shared/site-sign.pem';
    if (fs.existsSync(pemPath)) {
      const privateKey = crypto.createPrivateKey(fs.readFileSync(pemPath, 'utf8'));
      const publicKey = crypto.createPublicKey(privateKey);
      const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
      return { mode: 'ed25519', privateKey, publicKey, keyId, source: 'site-sign.pem' };
    }
  } catch (_) {}
  // In-process key (tests / cold start)
  if (global.__SITE_SIGN_KEY__) {
    try {
      const privateKey = global.__SITE_SIGN_KEY__;
      const publicKey = crypto.createPublicKey(privateKey);
      const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
      return { mode: 'ed25519', privateKey, publicKey, keyId, source: 'global' };
    } catch (_) {}
  }
  const secret = process.env.POMX_HMAC_SECRET || process.env.JWT_SECRET || 'zeusai-pomx-dev';
  return {
    mode: 'hmac-sha256',
    secret,
    keyId: secret === 'zeusai-pomx-dev' ? 'hmac:dev' : 'hmac:env',
    fallback: secret === 'zeusai-pomx-dev',
  };
}

function signBody(bodyStr) {
  const cfg = getSigningConfig();
  if (cfg.mode === 'ed25519') {
    return {
      algorithm: 'ed25519',
      keyId: cfg.keyId,
      signature: crypto.sign(null, Buffer.from(bodyStr), cfg.privateKey).toString('base64'),
    };
  }
  return {
    algorithm: 'hmac-sha256',
    keyId: cfg.keyId,
    signature: crypto.createHmac('sha256', cfg.secret).update(bodyStr).digest('base64'),
  };
}

function verifySignature(bodyStr, signature) {
  if (!signature || typeof signature !== 'object') {
    return { ok: false, reason: 'unsigned' };
  }
  const cfg = getSigningConfig();
  if (signature.algorithm === 'ed25519') {
    if (cfg.mode !== 'ed25519' || !cfg.publicKey) {
      return { ok: false, reason: 'missing_ed25519_public_key' };
    }
    const ok = crypto.verify(
      null,
      Buffer.from(bodyStr),
      cfg.publicKey,
      Buffer.from(String(signature.signature || ''), 'base64')
    );
    return { ok, algorithm: 'ed25519', keyId: signature.keyId || null };
  }
  if (signature.algorithm === 'hmac-sha256') {
    if (cfg.mode !== 'hmac-sha256') return { ok: false, reason: 'hmac_unavailable' };
    const expected = crypto.createHmac('sha256', cfg.secret).update(bodyStr).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature.signature || ''));
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, algorithm: 'hmac-sha256', keyId: signature.keyId || null };
  }
  return { ok: false, reason: 'unknown_algorithm' };
}

function exportPublicKey() {
  const cfg = getSigningConfig();
  if (cfg.mode === 'ed25519' && cfg.publicKey) {
    return {
      algorithm: 'ed25519',
      keyId: cfg.keyId,
      publicKeyPem: cfg.publicKey.export({ type: 'spki', format: 'pem' }),
    };
  }
  return { algorithm: cfg.mode, keyId: cfg.keyId, note: 'HMAC — verification requires shared secret (server-side)' };
}

// ── Catalog ingestion (multi-product, honest) ───────────────────────────
function _normalizeItem(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.serviceId || raw.slug || raw.sku || '').trim();
  if (!id) return null;
  const title = String(raw.title || raw.name || id);
  const retail = round2(raw.priceUsd ?? raw.priceUSD ?? raw.price ?? raw.amount ?? 0);
  if (!(retail > 0)) return null;

  let cost = Number(raw.costUsd ?? raw.costUSD ?? raw.cost);
  let shipping = Number(raw.shippingUsd ?? raw.shippingUSD ?? raw.shipping ?? 0);
  let net = Number(raw.netProfitUsd ?? raw.netProfit ?? raw.marginUsd);

  // SaaS / digital: cost floor = 0 platform take; net ≈ retail (owner keeps 100% of sale)
  const isPhysical = source === 'dropship'
    || String(raw.fulfillmentMode || '').includes('cj')
    || String(raw.fulfillmentMode || '') === 'desk'
    || String((raw.delivery && raw.delivery.mode) || '').includes('dropship')
    || String((raw.delivery && raw.delivery.mode) || '').includes('desk');

  if (!Number.isFinite(cost)) cost = isPhysical ? round2(retail * 0.35) : 0;
  if (!Number.isFinite(shipping)) shipping = isPhysical ? round2(Number(raw.shippingUsd) || 0) : 0;
  if (!Number.isFinite(net)) net = round2(Math.max(0, retail - cost - shipping));

  const marginPct = retail > 0 ? round2((net / retail) * 100) : 0;
  const fulfillment = isPhysical
    ? (raw.fulfillmentMode || (raw.delivery && raw.delivery.mode) || 'desk')
    : 'digital-instant';
  const automated = !!(raw.delivery && raw.delivery.automated === true)
    || fulfillment === 'cj-auto'
    || String(fulfillment).includes('cj-global');

  return {
    id,
    title,
    description: String(raw.description || '').slice(0, 400),
    group: String(raw.group || raw.category || source || 'marketplace'),
    source: source || String(raw.source || 'catalog'),
    retailUsd: retail,
    costUsd: round2(cost),
    shippingUsd: round2(shipping),
    netMarginUsd: round2(net),
    marginPct,
    platformTakeRatePct: 0,
    settlementRail: 'btc-direct-owner-wallet',
    settlementAddress: OWNER_BTC,
    fulfillmentMode: fulfillment,
    automated,
    page: raw.page || (source === 'dropship' ? `/dropship/product/${encodeURIComponent(id)}` : `/services/${encodeURIComponent(id)}`),
  };
}

function collectExchangeItems(sources) {
  const out = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  const src = sources || {};
  const lists = [
    ['saas', src.saas || src.services || []],
    ['marketplace', src.marketplace || []],
    ['vertical', src.verticals || []],
    ['dropship', src.dropship || []],
    ['agent', src.agent || []],
  ];
  for (const [label, arr] of lists) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) push(_normalizeItem(raw, label));
  }
  return out;
}

function attestSku(item) {
  const claims = {
    protocol: PROTOCOL,
    type: 'pomx.margin_attestation',
    skuId: item.id,
    title: item.title,
    group: item.group,
    source: item.source,
    economics: {
      retailUsd: item.retailUsd,
      costUsd: item.costUsd,
      shippingUsd: item.shippingUsd,
      netMarginUsd: item.netMarginUsd,
      marginPct: item.marginPct,
      platformTakeRatePct: 0,
    },
    settlement: {
      rail: item.settlementRail,
      address: item.settlementAddress,
      custody: 'owner-controlled-non-custodial',
    },
    fulfillment: {
      mode: item.fulfillmentMode,
      automated: !!item.automated,
      honesty: item.automated
        ? 'AUTO-SHIP only when real supplier variant + API key armed'
        : 'DESK or digital — never claims automated shipping without proof',
    },
    issuedAt: isoNow(),
    issuer: 'ZeusAI PoMX',
    domain: PUBLIC_BASE,
  };
  const body = stableStringify(claims);
  const claimsHash = sha256(body);
  const signature = signBody(body);
  state.attestationsIssued += 1;
  return {
    ok: true,
    protocol: PROTOCOL,
    claimsHash,
    claims,
    signature,
    verifyUrl: `${PUBLIC_BASE}/api/pomx/verify`,
    page: item.page,
  };
}

function buildExchange(sources, opts) {
  const limit = Math.max(1, Math.min(500, Number((opts && opts.limit) || 200)));
  const items = collectExchangeItems(sources).slice(0, limit);
  const listings = items.map((item) => {
    const attestation = attestSku(item);
    return {
      skuId: item.id,
      title: item.title,
      group: item.group,
      source: item.source,
      retailUsd: item.retailUsd,
      marginPct: item.marginPct,
      netMarginUsd: item.netMarginUsd,
      platformTakeRatePct: 0,
      fulfillmentMode: item.fulfillmentMode,
      automated: item.automated,
      page: item.page,
      claimsHash: attestation.claimsHash,
      attestation,
      buy: {
        human: item.page,
        agentQuote: 'POST /api/pomx/quote',
        agentOrder: 'POST /api/pomx/order',
      },
    };
  });

  const summary = {
    protocol: PROTOCOL,
    title: 'Proof-of-Margin Exchange',
    invention: 'World-first multi-SKU exchange where every offer carries a cryptographically signed margin attestation verifiable by any agent before purchase.',
    listings: listings.length,
    groups: [...new Set(listings.map((l) => l.group))],
    totalRetailUsd: round2(listings.reduce((s, l) => s + l.retailUsd, 0)),
    avgMarginPct: listings.length
      ? round2(listings.reduce((s, l) => s + l.marginPct, 0) / listings.length)
      : 0,
    platformTakeRatePct: 0,
    settlementRail: 'btc-direct-owner-wallet',
    settlementAddress: OWNER_BTC,
    railsArmed: {
      btc: true,
      nowpayments: _envArmed('NOWPAYMENTS_API_KEY'),
      stripe: _envArmed('STRIPE_SECRET_KEY'),
      paypal: _envArmed('PAYPAL_CLIENT_ID') && (_envArmed('PAYPAL_CLIENT_SECRET') || _envArmed('PAYPAL_SECRET')),
      email: _envArmed('RESEND_API_KEY') || _envArmed('BREVO_API_KEY') || _envArmed('MAILERSEND_API_KEY'),
      cj: _envArmed('ZACC_CJ_API_KEY') || _envArmed('CJ_API_KEY'),
    },
    publicKey: exportPublicKey(),
    endpoints: {
      discovery: '/.well-known/pomx.json',
      exchange: '/api/pomx/exchange',
      sku: '/api/pomx/sku/:id',
      verify: 'POST /api/pomx/verify',
      quote: 'POST /api/pomx/quote',
      order: 'POST /api/pomx/order',
      settlement: '/api/pomx/settlement/:id',
    },
    generatedAt: isoNow(),
  };

  const body = stableStringify({ summary: { ...summary, listings: undefined }, listingHashes: listings.map((l) => l.claimsHash) });
  const exchangeHash = sha256(body);
  const signature = signBody(body);
  state.lastExchangeAt = summary.generatedAt;

  try {
    ensureDir();
    fs.writeFileSync(path.join(dataDir(), 'last-exchange.json'), JSON.stringify({ summary, listings: listings.slice(0, 50), exchangeHash }, null, 2));
  } catch (_) {}

  return {
    ok: true,
    protocol: PROTOCOL,
    exchangeHash,
    signature,
    summary,
    listings,
  };
}

function getSkuAttestation(skuId, sources) {
  const items = collectExchangeItems(sources);
  const item = items.find((i) => i.id === String(skuId));
  if (!item) return { ok: false, error: 'sku_not_found', skuId };
  return attestSku(item);
}

function verifyAttestation(payload) {
  state.verifications += 1;
  const src = payload && (payload.attestation || payload);
  if (!src || !src.claims || !src.signature) {
    return { ok: false, valid: false, errors: ['missing_claims_or_signature'] };
  }
  const body = stableStringify(src.claims);
  const hashOk = !src.claimsHash || src.claimsHash === sha256(body);
  const sig = verifySignature(body, src.signature);
  const errors = [];
  if (!hashOk) errors.push('claims_hash_mismatch');
  if (!sig.ok) errors.push(sig.reason || 'signature_invalid');
  if (src.claims.protocol && src.claims.protocol !== PROTOCOL) errors.push('protocol_mismatch');
  return {
    ok: errors.length === 0,
    valid: errors.length === 0,
    protocol: PROTOCOL,
    claimsHash: src.claimsHash || sha256(body),
    signature: sig,
    economics: src.claims.economics || null,
    settlement: src.claims.settlement || null,
    errors,
    verifiedAt: isoNow(),
  };
}

function createQuote({ skuId, qty, sources, buyer }) {
  const att = getSkuAttestation(skuId, sources);
  if (!att.ok) return att;
  const q = Math.max(1, Math.min(100, Number(qty) || 1));
  const unit = att.claims.economics.retailUsd;
  const quoteId = 'pomx_q_' + crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const quote = {
    protocol: PROTOCOL,
    type: 'pomx.quote',
    quoteId,
    skuId: att.claims.skuId,
    title: att.claims.title,
    qty: q,
    unitUsd: unit,
    totalUsd: round2(unit * q),
    claimsHash: att.claimsHash,
    attestation: att,
    buyer: buyer || null,
    settlementRail: 'btc-direct-owner-wallet',
    settlementAddress: OWNER_BTC,
    issuedAt: isoNow(),
    expiresAt,
  };
  const body = stableStringify(quote);
  const quoteHash = sha256(body);
  const signature = signBody(body);
  const packed = { ok: true, quoteHash, quote, signature };
  _quotes.set(quoteId, packed);
  state.quotesIssued += 1;
  try {
    ensureDir();
    fs.appendFileSync(path.join(dataDir(), 'quotes.jsonl'), JSON.stringify({ quoteId, quoteHash, at: quote.issuedAt }) + '\n');
  } catch (_) {}
  return packed;
}

function createOrder({ quoteId, quoteHash, buyerEmail, sources }) {
  const packed = _quotes.get(String(quoteId || ''));
  if (!packed) return { ok: false, error: 'quote_not_found' };
  if (quoteHash && packed.quoteHash !== quoteHash) return { ok: false, error: 'quote_hash_mismatch' };
  if (Date.parse(packed.quote.expiresAt) < Date.now()) return { ok: false, error: 'quote_expired' };

  // Re-verify attestation still valid
  const v = verifyAttestation(packed.quote.attestation);
  if (!v.valid) return { ok: false, error: 'attestation_invalid', detail: v };

  const orderId = 'pomx_o_' + crypto.randomBytes(8).toString('hex');

  // Prefer salesOrchestrator async create when caller awaits via openSalesOrder().
  const order = {
    protocol: PROTOCOL,
    type: 'pomx.order',
    orderId,
    quoteId: packed.quote.quoteId,
    quoteHash: packed.quoteHash,
    skuId: packed.quote.skuId,
    title: packed.quote.title,
    qty: packed.quote.qty,
    totalUsd: packed.quote.totalUsd,
    claimsHash: packed.quote.claimsHash,
    buyerEmail: String(buyerEmail || '').toLowerCase() || null,
    status: 'awaiting_payment',
    settlementRail: 'btc-direct-owner-wallet',
    settlementAddress: OWNER_BTC,
    createdAt: isoNow(),
    checkout: {
      human: `${PUBLIC_BASE}/checkout/?plan=${encodeURIComponent(packed.quote.skuId)}&pomx=${encodeURIComponent(orderId)}`,
      agent: `${PUBLIC_BASE}/api/pomx/order/${orderId}`,
      btcAddress: OWNER_BTC,
    },
  };

  const body = stableStringify(order);
  const orderHash = sha256(body);
  const signature = signBody(body);
  const record = { ok: true, orderHash, order, signature, quote: packed.quote };
  _orders.set(orderId, record);
  state.ordersOpened += 1;
  try {
    ensureDir();
    fs.appendFileSync(path.join(dataDir(), 'orders.jsonl'), JSON.stringify({ orderId, orderHash, at: order.createdAt }) + '\n');
  } catch (_) {}
  return record;
}

async function openSalesOrder(orderRecord) {
  if (!orderRecord || !orderRecord.order) return { ok: false, error: 'order_required' };
  try {
    const sales = require('./salesOrchestrator');
    const out = await sales.createOrder({
      serviceId: orderRecord.order.skuId,
      email: orderRecord.order.buyerEmail,
      qty: orderRecord.order.qty,
      metadata: {
        pomx: true,
        pomxOrderId: orderRecord.order.orderId,
        claimsHash: orderRecord.order.claimsHash,
        protocol: PROTOCOL,
      },
    });
    if (out && out.ok) {
      orderRecord.order.salesOrderId = out.order && (out.order.id || out.invoice && out.invoice.id) || out.invoiceId || null;
      orderRecord.order.invoice = out.invoice || out.order || null;
      if (out.invoice && out.invoice.btcAddress) {
        orderRecord.order.checkout.btcAddress = out.invoice.btcAddress;
        orderRecord.order.checkout.btcAmount = out.invoice.btcAmount || out.invoice.amountBtc || null;
        orderRecord.order.checkout.invoiceUri = out.invoice.invoiceUri || out.invoice.uri || null;
      }
      _orders.set(orderRecord.order.orderId, orderRecord);
    }
    return out;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function attestSettlement({ orderId, payment, activation }) {
  const rec = _orders.get(String(orderId || '')) || null;
  const settlementId = 'pomx_s_' + crypto.randomBytes(8).toString('hex');
  const credential = {
    protocol: PROTOCOL,
    type: 'pomx.capability_credential',
    settlementId,
    orderId: orderId || (rec && rec.order && rec.order.orderId) || null,
    skuId: (rec && rec.order && rec.order.skuId) || (payment && payment.serviceId) || null,
    claimsHash: (rec && rec.order && rec.order.claimsHash) || null,
    buyerEmailHash: sha256(String((payment && payment.email) || (rec && rec.order && rec.order.buyerEmail) || '').toLowerCase()),
    payment: {
      rail: (payment && payment.rail) || 'btc-direct',
      txid: (payment && payment.txid) || null,
      amountUsd: (payment && payment.amountUsd) || (rec && rec.order && rec.order.totalUsd) || null,
      paidAt: (payment && payment.paidAt) || isoNow(),
    },
    activation: activation || null,
    platformTakeRatePct: 0,
    issuedAt: isoNow(),
    issuer: 'ZeusAI PoMX',
    domain: PUBLIC_BASE,
  };
  const body = stableStringify(credential);
  const credentialHash = sha256(body);
  const signature = signBody(body);
  const packed = {
    ok: true,
    settlementId,
    credentialHash,
    credential,
    signature,
    verifyUrl: `${PUBLIC_BASE}/api/pomx/verify`,
  };
  _settlements.set(settlementId, packed);
  if (rec) {
    rec.order.status = 'settled';
    rec.settlementId = settlementId;
    _orders.set(rec.order.orderId, rec);
  }
  state.settlementsAttested += 1;
  state.lastSettlementAt = credential.issuedAt;
  try {
    ensureDir();
    fs.appendFileSync(path.join(dataDir(), 'settlements.jsonl'), JSON.stringify({ settlementId, credentialHash, at: credential.issuedAt }) + '\n');
  } catch (_) {}
  return packed;
}

function getSettlement(id) {
  const packed = _settlements.get(String(id || ''));
  if (!packed) return { ok: false, error: 'settlement_not_found' };
  return packed;
}

function getOrder(id) {
  const packed = _orders.get(String(id || ''));
  if (!packed) return { ok: false, error: 'order_not_found' };
  return packed;
}

function discovery() {
  const cfg = getSigningConfig();
  return {
    ok: true,
    protocol: PROTOCOL,
    name: 'Proof-of-Margin Exchange',
    invention: 'Cryptographically attested multi-SKU commerce exchange for humans and AI agents — verify margin before you buy; receive an instant capability credential on settlement.',
    version: '1.0',
    domain: PUBLIC_BASE,
    owner: {
      name: process.env.OWNER_NAME || 'Vladoi Ionut',
      btc: OWNER_BTC,
    },
    signing: { mode: cfg.mode, keyId: cfg.keyId, fallback: !!cfg.fallback },
    publicKey: exportPublicKey(),
    endpoints: {
      exchange: `${PUBLIC_BASE}/api/pomx/exchange`,
      sku: `${PUBLIC_BASE}/api/pomx/sku/{id}`,
      verify: `${PUBLIC_BASE}/api/pomx/verify`,
      quote: `${PUBLIC_BASE}/api/pomx/quote`,
      order: `${PUBLIC_BASE}/api/pomx/order`,
      settlement: `${PUBLIC_BASE}/api/pomx/settlement/{id}`,
      human: `${PUBLIC_BASE}/pomx`,
      wacp: `${PUBLIC_BASE}/.well-known/wacp.json`,
      agents: `${PUBLIC_BASE}/.well-known/agents.json`,
    },
    principles: [
      'Multi-product — entire ZeusAI catalog, not a single SKU',
      'Signed Proof-of-Margin on every listing',
      'Agent-verifiable before purchase',
      '$0 platform take-rate — BTC settles to owner wallet',
      'Instant capability credential on settlement',
      'Honest fulfillment badges (AUTO only when supplier armed)',
    ],
    generatedAt: isoNow(),
  };
}

function getStatus() {
  const cfg = getSigningConfig();
  return {
    ok: true,
    module: NAME,
    protocol: PROTOCOL,
    signingMode: cfg.mode,
    keyId: cfg.keyId,
    fallbackSecretInUse: !!cfg.fallback,
    dataDir: dataDir(),
    stats: { ...state },
    quotesCached: _quotes.size,
    ordersCached: _orders.size,
    settlementsCached: _settlements.size,
  };
}

async function processInput(input) {
  const action = String((input && input.action) || 'status');
  const payload = (input && input.payload) || input || {};
  if (action === 'discovery') return discovery();
  if (action === 'exchange') return buildExchange(payload.sources || payload, payload);
  if (action === 'attest') return getSkuAttestation(payload.skuId || payload.id, payload.sources);
  if (action === 'verify') return verifyAttestation(payload);
  if (action === 'quote') return createQuote(payload);
  if (action === 'order') {
    const rec = createOrder(payload);
    if (rec.ok) await openSalesOrder(rec);
    return rec;
  }
  if (action === 'settle') return attestSettlement(payload);
  return getStatus();
}

function _resetForTests() {
  state.attestationsIssued = 0;
  state.quotesIssued = 0;
  state.ordersOpened = 0;
  state.settlementsAttested = 0;
  state.verifications = 0;
  state.lastExchangeAt = null;
  state.lastSettlementAt = null;
  _quotes.clear();
  _orders.clear();
  _settlements.clear();
}

module.exports = {
  name: NAME,
  PROTOCOL,
  discovery,
  buildExchange,
  collectExchangeItems,
  attestSku,
  getSkuAttestation,
  verifyAttestation,
  createQuote,
  createOrder,
  openSalesOrder,
  attestSettlement,
  getSettlement,
  getOrder,
  exportPublicKey,
  getStatus,
  process: processInput,
  processInput,
  _resetForTests,
};
