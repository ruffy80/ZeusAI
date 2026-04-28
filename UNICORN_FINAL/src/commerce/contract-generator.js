// commerce/contract-generator.js
// Generates HTML contracts with an Ed25519 signature embedded in the document
// (and as a sidecar .sig file). Signature uses global.__SITE_SIGN_KEY__ when
// available (already provisioned by src/index.js) — falls back to a local
// generated key persisted at data/commerce/contract-signing-key.pem.
//
// Exports:
//   create(deal) → contract { id, dealId, html, signatureB64, publicKeyPem }
//   byId(id) → contract | null
//   byDealId(dealId) → contract | null
//   html(contract) → string (full HTML doc)
//   verify(contract) → boolean

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const CONTRACTS_DIR = path.join(DATA_DIR, 'contracts');
const LOG_FILE = path.join(DATA_DIR, 'contracts.jsonl');
const KEY_FILE = path.join(DATA_DIR, 'contract-signing-key.pem');
const PUB_FILE = path.join(DATA_DIR, 'contract-signing-pub.pem');

function ensureDir() { try { fs.mkdirSync(CONTRACTS_DIR, { recursive: true }); } catch (_) {} }

function _signingKey() {
  if (global.__SITE_SIGN_KEY__) return global.__SITE_SIGN_KEY__;
  if (fs.existsSync(KEY_FILE)) {
    try { return crypto.createPrivateKey(fs.readFileSync(KEY_FILE, 'utf8')); } catch (_) {}
  }
  ensureDir();
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  try {
    fs.writeFileSync(KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(PUB_FILE, publicKey.export({ type: 'spki', format: 'pem' }));
  } catch (e) { console.warn('[contract-generator] key persist failed:', e.message); }
  return privateKey;
}
function _publicKeyPem() {
  const key = _signingKey();
  try { return crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString(); }
  catch (_) { return ''; }
}

function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

function _contractBody(deal, contractId, issuedAt) {
  const buyer = deal.buyer || {};
  const price = Number(deal.acceptedPriceUSD || deal.currentOfferUSD || deal.listPriceUSD || 0);
  return [
    'CONTRACT-ID: ' + contractId,
    'DEAL-ID: ' + deal.id,
    'PRODUCT: ' + (deal.productTitle || deal.productId),
    'PRODUCT-ID: ' + deal.productId,
    'BUYER-LEGAL-ENTITY: ' + (buyer.legalEntity || ''),
    'BUYER-CONTACT-NAME: ' + (buyer.contactName || ''),
    'BUYER-EMAIL: ' + (buyer.email || ''),
    'BUYER-JURISDICTION: ' + (buyer.jurisdiction || ''),
    'PRICE-USD: ' + price.toFixed(2),
    'CURRENCY: ' + (deal.currency || 'USD'),
    'ISSUED-AT: ' + issuedAt,
    'STATE: ' + (deal.state || 'confirmed')
  ].join('\n');
}

const _byId = new Map();
const _byDealId = new Map();

function _hydrate() {
  if (!fs.existsSync(LOG_FILE)) return;
  try {
    const text = fs.readFileSync(LOG_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      try {
        const c = JSON.parse(t);
        if (!c || !c.id) continue;
        _byId.set(c.id, c);
        if (c.dealId) _byDealId.set(c.dealId, c);
      } catch (_) {}
    }
  } catch (e) { console.warn('[contract-generator] hydrate failed:', e.message); }
}
_hydrate();

function create(deal) {
  if (!deal || !deal.id) throw new Error('deal_required');
  const existing = _byDealId.get(deal.id);
  if (existing) return existing;
  ensureDir();
  const contractId = 'ctr_' + crypto.randomBytes(8).toString('hex');
  const issuedAt = new Date().toISOString();
  const body = _contractBody(deal, contractId, issuedAt);
  const key = _signingKey();
  const sig = crypto.sign(null, Buffer.from(body, 'utf8'), key);
  const sigB64 = sig.toString('base64');
  const publicKeyPem = _publicKeyPem();

  const contract = {
    id: contractId,
    dealId: deal.id,
    productId: deal.productId,
    buyer: deal.buyer || null,
    priceUSD: Number(deal.acceptedPriceUSD || deal.currentOfferUSD || deal.listPriceUSD || 0),
    currency: deal.currency || 'USD',
    state: deal.state || 'confirmed',
    issuedAt,
    body,
    signatureB64: sigB64,
    publicKeyPem,
    signatureAlg: 'Ed25519'
  };

  // Persist sidecar files for auditors.
  try {
    fs.writeFileSync(path.join(CONTRACTS_DIR, contractId + '.txt'), body);
    fs.writeFileSync(path.join(CONTRACTS_DIR, contractId + '.sig'), sigB64);
    fs.appendFileSync(LOG_FILE, JSON.stringify(contract) + '\n');
  } catch (e) { console.warn('[contract-generator] persist failed:', e.message); }

  _byId.set(contract.id, contract);
  _byDealId.set(deal.id, contract);
  return contract;
}

function byId(id) { return _byId.get(String(id || '')) || null; }
function byDealId(dealId) { return _byDealId.get(String(dealId || '')) || null; }

function html(contract) {
  if (!contract) return '<h1>Contract not found</h1>';
  const body = _esc(contract.body);
  const sig = _esc(contract.signatureB64);
  const pk = _esc(contract.publicKeyPem);
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<title>Contract ' + _esc(contract.id) + '</title>',
    '<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:920px;margin:32px auto;padding:0 24px;color:#111;line-height:1.55}',
    'h1{border-bottom:2px solid #6d28d9;padding-bottom:8px;color:#4c1d95}',
    'pre{background:#0b1020;color:#e8ecff;padding:16px;border-radius:8px;overflow:auto}',
    '.sig{background:#faf5ff;border-left:4px solid #6d28d9;padding:12px 16px;margin:16px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}',
    '.meta{color:#6b7280;font-size:13px}</style></head><body>',
    '<h1>Unicorn / ZeusAI — Signed Contract</h1>',
    '<p class="meta">Contract ID: <code>' + _esc(contract.id) + '</code> · Deal: <code>' + _esc(contract.dealId) + '</code> · Issued: ' + _esc(contract.issuedAt) + '</p>',
    '<h2>Body (canonical, signed verbatim)</h2>',
    '<pre>' + body + '</pre>',
    '<h2>Signature (Ed25519, base64)</h2>',
    '<div class="sig">' + sig + '</div>',
    '<h2>Public key (PEM)</h2>',
    '<pre>' + pk + '</pre>',
    '<h2>Verify</h2>',
    '<p class="meta">Use OpenSSL: <code>openssl pkeyutl -verify -pubin -inkey pub.pem -rawin -in body.txt -sigfile signature.bin</code></p>',
    '</body></html>'
  ].join('');
}

function verify(contract) {
  if (!contract || !contract.body || !contract.signatureB64 || !contract.publicKeyPem) return false;
  try {
    const pub = crypto.createPublicKey(contract.publicKeyPem);
    return crypto.verify(null, Buffer.from(contract.body, 'utf8'), pub, Buffer.from(contract.signatureB64, 'base64'));
  } catch (_) { return false; }
}

function _resetForTests() {
  _byId.clear(); _byDealId.clear();
  try { fs.rmSync(LOG_FILE, { force: true }); } catch (_) {}
  try { fs.rmSync(CONTRACTS_DIR, { recursive: true, force: true }); } catch (_) {}
}

module.exports = { create, byId, byDealId, html, verify, _resetForTests };
