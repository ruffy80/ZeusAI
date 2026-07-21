'use strict';

/**
 * Earth Outcome Protocol — EOP/1.0
 * --------------------------------
 * World-first interdomain outcome passport for the machine economy.
 *
 * Every commercial act across ANY domain class (software, commerce, logistics,
 * education, professional, media, energy, health_ops, civic, general) can mint
 * a cryptographically signed Outcome Passport that chains:
 *   domain classification → economics → settlement → delivery → outcome → trust
 *
 * Any agent, insurer, regulator, or marketplace verifies the passport without
 * trusting a UI. Cross-domain trust scores accumulate into a public mesh —
 * the missing passport layer the internet never invented.
 *
 * Platform take-rate on Zeus settlement rails: $0 (owner BTC wallet).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'EOP/1.0';
const NAME = 'Earth Outcome Protocol';
const PUBLIC_BASE = String(process.env.PUBLIC_BASE_URL || process.env.SITE_URL || 'https://zeusai.pro').replace(/\/$/, '');
const OWNER = {
  name: process.env.LEGAL_OWNER_NAME || 'Vladoi Ionut',
  email: process.env.LEGAL_OWNER_EMAIL || 'vladoi_ionut@yahoo.com',
  btc: process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
};
const FALLBACK_HMAC = 'zeusai-eop-dev-fallback';

const DOMAINS = Object.freeze({
  software: {
    id: 'software',
    label: 'Software & AI capability',
    units: ['api_calls', 'seats', 'licenses', 'hours_automated'],
    examples: ['SaaS plans', 'API usage', 'enterprise workspace'],
  },
  commerce: {
    id: 'commerce',
    label: 'Physical & digital commerce',
    units: ['orders', 'units_shipped', 'gmv_usd'],
    examples: ['Dropship', 'catalog SKUs', 'fulfillment'],
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics & delivery ops',
    units: ['shipments', 'eta_days', 'miles'],
    examples: ['Carrier orchestration', 'desk fulfill'],
  },
  education: {
    id: 'education',
    label: 'Education & enablement',
    units: ['courses', 'completions', 'skills_unlocked'],
    examples: ['Playbooks', 'training packs'],
  },
  professional: {
    id: 'professional',
    label: 'Professional services',
    units: ['engagements', 'deliverables', 'hours'],
    examples: ['Legal, advisory, architecture'],
  },
  media: {
    id: 'media',
    label: 'Media & distribution',
    units: ['impressions', 'posts', 'reach'],
    examples: ['Outbound, social, SEO'],
  },
  energy: {
    id: 'energy',
    label: 'Energy & efficiency',
    units: ['kwh_saved', 'co2e_kg'],
    examples: ['Efficiency audits', 'grid ops'],
  },
  health_ops: {
    id: 'health_ops',
    label: 'Health operations (non-clinical)',
    units: ['workflows', 'errors_prevented'],
    examples: ['Ops automation — not medical advice'],
  },
  civic: {
    id: 'civic',
    label: 'Civic & compliance',
    units: ['filings', 'attestations', 'violations_avoided'],
    examples: ['Transparency, compliance packs'],
  },
  general: {
    id: 'general',
    label: 'General capability',
    units: ['outcomes', 'usd_value'],
    examples: ['Unclassified digital goods'],
  },
});

const KEYWORDS = [
  [/dropship|sku|fulfill|shipping|commerce|store|product|catalog/i, 'commerce'],
  [/logistics|carrier|shipment|freight|warehouse|eta/i, 'logistics'],
  [/course|train|educat|playbook|lesson|skill/i, 'education'],
  [/legal|contract|advisory|consult|architect|professional/i, 'professional'],
  [/social|seo|content|viral|media|post|outreach|telegram/i, 'media'],
  [/energy|kwh|grid|carbon|co2/i, 'energy'],
  [/health|clinic|patient|medical|hipaa/i, 'health_ops'],
  [/gov|civic|compliance|regulat|attestat|sovereign/i, 'civic'],
  [/api|saas|software|ai|agent|workspace|enterprise|plan|pro|starter/i, 'software'],
];

const DATA_DIR = process.env.EOP_DATA_DIR || path.resolve(__dirname, '..', '..', 'data', 'eop');
const LEDGER = path.join(DATA_DIR, 'outcome-passports.jsonl');

const state = {
  minted: 0,
  verified: 0,
  classified: 0,
  lastPassportId: null,
  lastMintAt: null,
  trustByDomain: {},
  passports: new Map(), // id → passport
};

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* tolerate */ }
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
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

function loadSiteSignPem() {
  if (global.__SITE_SIGN_KEY__) return global.__SITE_SIGN_KEY__;
  const candidates = [
    process.env.SITE_SIGN_PEM,
    process.env.EOP_ED25519_PRIVATE_KEY,
    '/var/www/unicorn/shared/site-sign.pem',
    path.resolve(__dirname, '..', '..', '..', 'shared', 'site-sign.pem'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (p.includes('BEGIN') && p.includes('PRIVATE')) return p;
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch (_) { /* try next */ }
  }
  return null;
}

function getSigningConfig() {
  const pem = loadSiteSignPem();
  if (pem) {
    try {
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      const keyId = 'ed25519:' + sha256(publicKey.export({ type: 'spki', format: 'pem' })).slice(0, 16);
      return { mode: 'ed25519', privateKey, publicKey, keyId, fallback: false };
    } catch (e) {
      /* fall through to hmac */
    }
  }
  const secret = process.env.EOP_HMAC_SECRET || process.env.JWT_SECRET || FALLBACK_HMAC;
  return {
    mode: 'hmac-sha256',
    secret,
    keyId: secret === FALLBACK_HMAC ? 'hmac:dev-fallback' : 'hmac:env',
    fallback: secret === FALLBACK_HMAC,
  };
}

function signBody(body) {
  const cfg = getSigningConfig();
  if (cfg.mode === 'ed25519') {
    return {
      algorithm: 'ed25519',
      keyId: cfg.keyId,
      signature: crypto.sign(null, Buffer.from(body), cfg.privateKey).toString('base64'),
    };
  }
  return {
    algorithm: 'hmac-sha256',
    keyId: cfg.keyId,
    signature: crypto.createHmac('sha256', cfg.secret).update(body).digest('base64'),
  };
}

function verifySignature(body, signature) {
  if (!signature || typeof signature !== 'object') {
    return { ok: false, reason: 'missing_signature' };
  }
  const cfg = getSigningConfig();
  if (signature.algorithm === 'ed25519') {
    if (cfg.mode !== 'ed25519' || !cfg.publicKey) {
      return { ok: false, reason: 'missing_ed25519_public_key' };
    }
    const ok = crypto.verify(
      null,
      Buffer.from(body),
      cfg.publicKey,
      Buffer.from(String(signature.signature || ''), 'base64')
    );
    return { ok, algorithm: 'ed25519', keyId: signature.keyId || null };
  }
  if (signature.algorithm === 'hmac-sha256') {
    if (cfg.mode !== 'hmac-sha256') return { ok: false, reason: 'hmac_secret_not_available' };
    const expected = crypto.createHmac('sha256', cfg.secret).update(body).digest('base64');
    const left = Buffer.from(expected);
    const right = Buffer.from(String(signature.signature || ''));
    const ok = left.length === right.length && crypto.timingSafeEqual(left, right);
    return { ok, algorithm: 'hmac-sha256', keyId: signature.keyId || null };
  }
  return { ok: false, reason: 'unsupported_signature_algorithm' };
}

function publicKeyInfo() {
  const cfg = getSigningConfig();
  if (cfg.mode === 'ed25519' && cfg.publicKey) {
    return {
      algorithm: 'ed25519',
      keyId: cfg.keyId,
      publicKeyPem: cfg.publicKey.export({ type: 'spki', format: 'pem' }),
    };
  }
  return { algorithm: cfg.mode, keyId: cfg.keyId, publicKeyPem: null };
}

function classify(input = {}) {
  state.classified += 1;
  const text = [
    input.domain,
    input.skuId,
    input.sku,
    input.id,
    input.title,
    input.name,
    input.category,
    input.group,
    input.source,
    ...(Array.isArray(input.tags) ? input.tags : []),
  ].filter(Boolean).join(' ');

  const forced = String(input.domain || '').trim().toLowerCase();
  if (forced && DOMAINS[forced]) {
    return {
      ok: true,
      domain: DOMAINS[forced].id,
      label: DOMAINS[forced].label,
      confidence: 1,
      method: 'explicit',
      units: DOMAINS[forced].units,
    };
  }

  for (const [re, domainId] of KEYWORDS) {
    if (re.test(text)) {
      return {
        ok: true,
        domain: domainId,
        label: DOMAINS[domainId].label,
        confidence: 0.82,
        method: 'keyword',
        units: DOMAINS[domainId].units,
      };
    }
  }

  return {
    ok: true,
    domain: 'general',
    label: DOMAINS.general.label,
    confidence: 0.4,
    method: 'default',
    units: DOMAINS.general.units,
  };
}

function trustDelta(claims) {
  const retail = Number(claims.economics && claims.economics.retailUsd) || 0;
  const outcomeUsd = Number(claims.outcome && claims.outcome.valueUsd) || 0;
  const delivered = !!(claims.delivery && claims.delivery.artifactCount > 0);
  let score = 8;
  if (delivered) score += 12;
  if (outcomeUsd > 0) score += Math.min(30, Math.round(Math.log10(outcomeUsd + 1) * 10));
  if (retail > 0) score += Math.min(15, Math.round(Math.log10(retail + 1) * 6));
  if (claims.economics && Number(claims.economics.platformTakeRatePct) === 0) score += 5;
  return Math.max(1, Math.min(100, score));
}

function persistPassport(passport) {
  ensureDir();
  try {
    fs.appendFileSync(LEDGER, JSON.stringify(passport) + '\n', 'utf8');
  } catch (_) { /* tolerate */ }
  state.passports.set(passport.id, passport);
  if (state.passports.size > 5000) {
    const first = state.passports.keys().next().value;
    state.passports.delete(first);
  }
}

function loadLedgerBestEffort() {
  try {
    if (!fs.existsSync(LEDGER)) return;
    const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).slice(-2000);
    for (const line of lines) {
      try {
        const p = JSON.parse(line);
        if (p && p.id) state.passports.set(p.id, p);
      } catch (_) { /* skip */ }
    }
    state.minted = Math.max(state.minted, state.passports.size);
    for (const p of state.passports.values()) {
      const d = p.claims && p.claims.domain && p.claims.domain.id;
      if (!d) continue;
      state.trustByDomain[d] = (state.trustByDomain[d] || 0) + Number(p.claims.trustDelta || 0);
    }
  } catch (_) { /* tolerate */ }
}

let _loaded = false;
function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;
  loadLedgerBestEffort();
}

function mint(input = {}) {
  ensureLoaded();
  const classification = classify(input);
  const orderId = String(input.orderId || input.receiptId || '').trim().slice(0, 128);
  const skuId = String(input.skuId || input.sku || input.serviceId || input.id || 'unknown').slice(0, 96);
  const title = String(input.title || input.name || skuId).slice(0, 200);
  const retailUsd = round2(input.retailUsd ?? input.priceUsd ?? input.amount ?? 0);
  const costUsd = round2(input.costUsd ?? 0);
  const outcomeAmount = Number(input.outcomeAmount ?? input.amount ?? retailUsd);
  const outcomeUnit = String(input.outcomeUnit || input.unit || (classification.units[0] || 'usd')).slice(0, 48);
  const valueUsd = round2(input.valueUsd ?? (outcomeUnit === 'usd' ? outcomeAmount : retailUsd));
  const artifacts = Array.isArray(input.artifactHashes)
    ? input.artifactHashes.map((h) => String(h).toLowerCase()).filter(Boolean).slice(0, 32)
    : [];
  const buyerHash = input.buyerEmail
    ? sha256(String(input.buyerEmail).trim().toLowerCase())
    : (input.buyerHash ? String(input.buyerHash).slice(0, 64) : null);

  const claims = {
    protocol: PROTOCOL,
    domain: {
      id: classification.domain,
      label: classification.label,
      confidence: classification.confidence,
      method: classification.method,
    },
    offer: {
      skuId,
      title,
      category: String(input.category || input.group || '').slice(0, 64) || null,
    },
    economics: {
      retailUsd,
      costUsd,
      netMarginUsd: round2(retailUsd - costUsd),
      marginPct: retailUsd > 0 ? Math.round(((retailUsd - costUsd) / retailUsd) * 100) : 0,
      platformTakeRatePct: 0,
      currency: 'USD',
      settlementRail: String(input.settlementRail || 'btc-direct-owner-wallet'),
      settlementAddress: OWNER.btc,
    },
    settlement: {
      orderId: orderId || null,
      source: String(input.source || 'manual').slice(0, 64),
      settledAt: String(input.settledAt || new Date().toISOString()),
    },
    delivery: {
      deliveryId: input.deliveryId ? String(input.deliveryId).slice(0, 128) : null,
      artifactCount: artifacts.length,
      artifactRoot: artifacts.length
        ? sha256(artifacts.slice().sort().join('|'))
        : null,
    },
    outcome: {
      metric: String(input.outcome || input.metric || 'value_delivered').slice(0, 96),
      unit: outcomeUnit,
      amount: Number.isFinite(outcomeAmount) ? outcomeAmount : 0,
      valueUsd,
      proof: input.proof ? String(input.proof).slice(0, 512) : null,
    },
    subject: { buyerHash },
    issuer: {
      name: OWNER.name,
      domain: PUBLIC_BASE,
      did: 'did:web:zeusai.pro',
    },
    issuedAt: new Date().toISOString(),
  };

  claims.trustDelta = trustDelta(claims);
  const claimsHash = sha256(stableStringify(claims));
  const body = stableStringify({ claimsHash, claims });
  const signature = signBody(body);
  const id = 'eop_' + claimsHash.slice(0, 20);

  const passport = {
    ok: true,
    protocol: PROTOCOL,
    id,
    claimsHash,
    claims,
    signature,
    verifyUrl: `${PUBLIC_BASE}/api/eop/verify`,
    humanUrl: `${PUBLIC_BASE}/earth#${id}`,
  };

  persistPassport(passport);
  state.minted += 1;
  state.lastPassportId = id;
  state.lastMintAt = claims.issuedAt;
  state.trustByDomain[classification.domain] =
    (state.trustByDomain[classification.domain] || 0) + claims.trustDelta;

  return passport;
}

function verify(input = {}) {
  ensureLoaded();
  state.verified += 1;
  let passport = input.passport || input;
  if (input.id && !input.claims) {
    passport = state.passports.get(String(input.id)) || passport;
  }
  if (!passport || !passport.claims) {
    return { ok: false, valid: false, error: 'passport_required' };
  }
  const claimsHash = sha256(stableStringify(passport.claims));
  const body = stableStringify({ claimsHash, claims: passport.claims });
  const sig = verifySignature(body, passport.signature);
  const hashOk = claimsHash === passport.claimsHash;
  const valid = !!(sig.ok && hashOk);
  return {
    ok: true,
    valid,
    protocol: PROTOCOL,
    id: passport.id || null,
    claimsHash,
    hashOk,
    signature: sig,
    domain: passport.claims.domain || null,
    economics: passport.claims.economics || null,
    trustDelta: passport.claims.trustDelta || 0,
    errors: [
      ...(hashOk ? [] : ['claims_hash_mismatch']),
      ...(sig.ok ? [] : [sig.reason || 'signature_invalid']),
    ],
    verifiedAt: new Date().toISOString(),
  };
}

function getPassport(id) {
  ensureLoaded();
  const p = state.passports.get(String(id || ''));
  if (!p) return { ok: false, error: 'not_found' };
  return { ok: true, passport: p };
}

function mesh(limit = 50) {
  ensureLoaded();
  const domains = Object.keys(DOMAINS).map((id) => ({
    id,
    label: DOMAINS[id].label,
    trustScore: round2(state.trustByDomain[id] || 0),
    units: DOMAINS[id].units,
  })).sort((a, b) => b.trustScore - a.trustScore);

  const recent = Array.from(state.passports.values())
    .slice(-Math.min(200, Math.max(1, Number(limit) || 50)))
    .reverse()
    .map((p) => ({
      id: p.id,
      domain: p.claims.domain.id,
      title: p.claims.offer.title,
      retailUsd: p.claims.economics.retailUsd,
      valueUsd: p.claims.outcome.valueUsd,
      trustDelta: p.claims.trustDelta,
      issuedAt: p.claims.issuedAt,
      claimsHash: p.claimsHash,
    }));

  return {
    ok: true,
    protocol: PROTOCOL,
    invention: 'Portable interdomain Outcome Passports — verify delivered value across every industry class.',
    domains,
    totalPassports: state.passports.size,
    totalTrust: round2(Object.values(state.trustByDomain).reduce((s, n) => s + n, 0)),
    recent,
    generatedAt: new Date().toISOString(),
  };
}

function discovery() {
  const cfg = getSigningConfig();
  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    invention: 'World-first Earth Outcome Protocol: a portable, cryptographically signed interdomain Outcome Passport that chains classification → economics → settlement → delivery → measurable outcome → trust — verifiable by any agent across every industry.',
    version: '1.0',
    domain: PUBLIC_BASE,
    owner: OWNER,
    signing: { mode: cfg.mode, keyId: cfg.keyId, fallback: !!cfg.fallback },
    publicKey: publicKeyInfo(),
    domains: Object.keys(DOMAINS),
    endpoints: {
      discovery: `${PUBLIC_BASE}/.well-known/eop.json`,
      domains: `${PUBLIC_BASE}/api/eop/domains`,
      mesh: `${PUBLIC_BASE}/api/eop/mesh`,
      classify: `${PUBLIC_BASE}/api/eop/classify`,
      mint: `${PUBLIC_BASE}/api/eop/mint`,
      verify: `${PUBLIC_BASE}/api/eop/verify`,
      passport: `${PUBLIC_BASE}/api/eop/passport/{id}`,
      status: `${PUBLIC_BASE}/api/eop/status`,
      human: `${PUBLIC_BASE}/earth`,
      pomx: `${PUBLIC_BASE}/.well-known/pomx.json`,
      wacp: `${PUBLIC_BASE}/.well-known/wacp.json`,
    },
    principles: [
      'Multi-domain — software, commerce, logistics, education, professional, media, energy, health_ops, civic',
      'One passport chains margin honesty + settlement + delivery + outcome',
      'Agent-verifiable without trusting a UI',
      '$0 platform take-rate on Zeus settlement rails',
      'Cross-domain trust mesh accumulates from real deliveries',
      'Compatible with PoMX margin attestations and WACP envelopes',
    ],
    takeRate: 0,
  };
}

function listDomains() {
  return {
    ok: true,
    protocol: PROTOCOL,
    domains: Object.values(DOMAINS),
  };
}

function getStatus() {
  ensureLoaded();
  const cfg = getSigningConfig();
  return {
    ok: true,
    name: 'earth-outcome-protocol',
    protocol: PROTOCOL,
    minted: state.minted,
    verified: state.verified,
    classified: state.classified,
    passportsInMemory: state.passports.size,
    lastPassportId: state.lastPassportId,
    lastMintAt: state.lastMintAt,
    trustByDomain: { ...state.trustByDomain },
    signing: { mode: cfg.mode, keyId: cfg.keyId, fallback: !!cfg.fallback },
    skuClasses: Object.keys(DOMAINS),
  };
}

async function processAction(body = {}) {
  const action = String(body.action || 'status').toLowerCase();
  if (action === 'classify') return classify(body);
  if (action === 'mint') return mint(body);
  if (action === 'verify') return verify(body);
  if (action === 'mesh') return mesh(body.limit);
  if (action === 'discovery') return discovery();
  return getStatus();
}

/**
 * Express/site path handler — returns true when handled.
 */
async function handle(req, res) {
  const url = String((req.url || '').split('?')[0]);
  const method = String(req.method || 'GET').toUpperCase();

  const send = (code, obj) => {
    try {
      res.statusCode = code;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', code === 200 ? 'public, max-age=30' : 'no-store');
      res.end(JSON.stringify(obj));
    } catch (_) { /* tolerate */ }
    return true;
  };

  if (url === '/.well-known/eop.json' || url === '/api/eop/discovery' || url === '/api/eop') {
    return send(200, discovery());
  }
  if (url === '/api/eop/domains') return send(200, listDomains());
  if (url === '/api/eop/mesh') {
    const q = req.url.includes('?') ? new URL(req.url, 'http://local').searchParams : null;
    return send(200, mesh(q && q.get('limit')));
  }
  if (url === '/api/eop/status') return send(200, { ok: true, status: getStatus() });

  if (url.startsWith('/api/eop/passport/')) {
    const id = decodeURIComponent(url.slice('/api/eop/passport/'.length));
    const found = getPassport(id);
    return send(found.ok ? 200 : 404, found);
  }

  if (method === 'POST' && url === '/api/eop/classify') {
    const body = await readJson(req);
    return send(200, classify(body));
  }
  if (method === 'POST' && url === '/api/eop/mint') {
    const body = await readJson(req);
    return send(200, mint(body));
  }
  if (method === 'POST' && url === '/api/eop/verify') {
    const body = await readJson(req);
    return send(200, verify(body));
  }

  return false;
}

function readJson(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) raw = raw.slice(0, 1e6); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

/** Hook for pay-fulfill / settlement paths — never throws. */
function mintFromSettlement(receipt = {}, delivery = null, source = 'settlement') {
  try {
    const artifacts = [];
    const pkg = delivery && (delivery.delivery || delivery);
    const files = []
      .concat((pkg && pkg.items) || [])
      .concat((pkg && pkg.artifacts) || [])
      .concat((pkg && pkg.deliverables) || []);
    for (const f of files) {
      const name = (f && (f.filename || f.name || f.title)) || '';
      if (name) artifacts.push(sha256(String(name)));
    }
    return mint({
      orderId: receipt.orderId || receipt.id,
      skuId: receipt.serviceId || receipt.skuId || receipt.productId,
      title: receipt.serviceName || receipt.title || receipt.productTitle,
      retailUsd: receipt.amountUsd || receipt.totalUsd || receipt.priceUsd,
      buyerEmail: receipt.email || receipt.buyerEmail,
      deliveryId: pkg && (pkg.deliveryId || pkg.id),
      artifactHashes: artifacts,
      source,
      outcome: 'value_delivered',
      outcomeUnit: 'usd',
      valueUsd: receipt.amountUsd || receipt.totalUsd || receipt.priceUsd,
    });
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

module.exports = {
  PROTOCOL,
  NAME,
  DOMAINS,
  classify,
  mint,
  verify,
  getPassport,
  mesh,
  discovery,
  listDomains,
  getStatus,
  process: processAction,
  processAction,
  handle,
  mintFromSettlement,
  getSigningConfig,
  publicKeyInfo,
};
