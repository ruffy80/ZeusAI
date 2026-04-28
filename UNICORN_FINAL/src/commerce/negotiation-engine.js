// commerce/negotiation-engine.js
// In-memory deal state machine with JSONL persistence.
// States: open → countered (looped) → accepted → pending_governance → confirmed
//
// Exports:
//   startDeal({productId, buyer, offerUSD, message}) → deal
//   counter(dealId, offerUSD, message)               → deal
//   accept(dealId)                                   → deal
//   confirmGovernance(dealId, otp)                   → deal
//   getDeal(id), listDeals(), _resetForTests()

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const LOG_FILE = path.join(DATA_DIR, 'negotiation.jsonl');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

const _deals = new Map();       // id → deal
const _otps = new Map();        // dealId → { otp, expiresAt }

function _hydrate() {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return;
  try {
    const text = fs.readFileSync(LOG_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      try {
        const evt = JSON.parse(t);
        if (evt.type === 'snapshot' && evt.deal) _deals.set(evt.deal.id, evt.deal);
      } catch (_) {}
    }
  } catch (e) { console.warn('[negotiation] hydrate failed:', e.message); }
}

function _persist(deal) {
  ensureDir();
  try { fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), type: 'snapshot', deal }) + '\n'); }
  catch (e) { console.warn('[negotiation] persist failed:', e.message); }
}

function _entCatalog() { try { return require('./enterprise-catalog'); } catch (_) { return null; } }
function _contracts()  { try { return require('./contract-generator'); } catch (_) { return null; } }
function _governance() { try { return require('./governance'); } catch (_) { return null; } }

function _validateBuyer(b) {
  if (!b || typeof b !== 'object') throw new Error('buyer_required');
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('buyer_email_invalid');
  return {
    legalEntity: String(b.legalEntity || b.name || '').slice(0, 200),
    contactName: String(b.contactName || b.name || '').slice(0, 200),
    email,
    jurisdiction: String(b.jurisdiction || '').slice(0, 80)
  };
}

function startDeal(p) {
  const productId = String((p && p.productId) || '');
  if (!productId) throw new Error('productId_required');
  const cat = _entCatalog();
  const product = cat ? cat.byId(productId) : null;
  if (!product) throw new Error('product_not_found');
  const buyer = _validateBuyer(p && p.buyer);
  const initialOffer = Math.max(0, Number((p && p.offerUSD) || 0));
  const deal = {
    id: 'deal_' + crypto.randomBytes(8).toString('hex'),
    productId,
    productTitle: product.title,
    listPriceUSD: Number(product.priceUSD || 0),
    currency: product.currency || 'USD',
    buyer,
    state: 'open',
    history: [
      { at: new Date().toISOString(), actor: 'buyer', action: 'open', offerUSD: initialOffer, message: String((p && p.message) || '') }
    ],
    currentOfferUSD: initialOffer,
    counterOfferUSD: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  _deals.set(deal.id, deal);
  _persist(deal);
  return deal;
}

function getDeal(id) { return _deals.get(String(id || '')) || null; }
function listDeals() {
  return Array.from(_deals.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function counter(dealId, offerUSD, message) {
  const d = getDeal(dealId);
  if (!d) throw new Error('deal_not_found');
  if (d.state === 'confirmed' || d.state === 'rejected') throw new Error('deal_closed');
  const offer = Math.max(0, Number(offerUSD || 0));
  // Auto-counter heuristic: seller never goes below 50% of list and never below current buyer offer.
  const floor = Math.max(d.listPriceUSD * 0.5, offer);
  const sellerCounter = Math.round(Math.max(d.listPriceUSD * 0.85, floor));
  d.currentOfferUSD = offer;
  d.counterOfferUSD = sellerCounter;
  d.state = 'countered';
  d.history.push({ at: new Date().toISOString(), actor: 'buyer', action: 'counter', offerUSD: offer, message: String(message || '') });
  d.history.push({ at: new Date().toISOString(), actor: 'seller', action: 'counter', offerUSD: sellerCounter, message: 'Auto-counter at 85% list (or 50% floor).' });
  d.updatedAt = new Date().toISOString();
  _persist(d);
  return d;
}

function accept(dealId) {
  const d = getDeal(dealId);
  if (!d) throw new Error('deal_not_found');
  if (d.state === 'confirmed') return d;
  d.acceptedPriceUSD = d.counterOfferUSD || d.currentOfferUSD || d.listPriceUSD;
  d.state = 'pending_governance';
  // Generate OTP for governance confirmation.
  const otp = ('' + (crypto.randomInt(0, 999999))).padStart(6, '0');
  _otps.set(d.id, { otp, expiresAt: Date.now() + 30 * 60 * 1000 });
  d.governanceOtpHint = otp.slice(-2); // last-2-digits hint only; full OTP only via secure channel
  d.history.push({ at: new Date().toISOString(), actor: 'system', action: 'accept', offerUSD: d.acceptedPriceUSD });
  d.updatedAt = new Date().toISOString();
  // Persist OTPs to an ops-only sidecar file (mode 0600) so the governance officer
  // can retrieve the OTP without it ever reaching stdout/journald in production.
  // Set NEGOTIATION_LOG_OTP=1 to ALSO print to stdout for local development only.
  try {
    ensureDir();
    const OTP_FILE = path.join(DATA_DIR, 'governance-otps.jsonl');
    fs.appendFileSync(OTP_FILE, JSON.stringify({ ts: new Date().toISOString(), dealId: d.id, otp, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) + '\n');
    try { fs.chmodSync(OTP_FILE, 0o600); } catch (_) {}
  } catch (e) { console.warn('[negotiation] otp persist failed:', e.message); }
  if (process.env.NEGOTIATION_LOG_OTP === '1') {
    console.log('[negotiation] deal=%s OTP=%s (governance only · dev mode)', d.id, otp);
  }
  // Audit via governance module if available.
  try {
    const g = _governance();
    if (g && typeof g.recordAudit === 'function') g.recordAudit({ kind: 'deal_accept', dealId: d.id, priceUSD: d.acceptedPriceUSD });
  } catch (_) {}
  _persist(d);
  return d;
}

function confirmGovernance(dealId, otp) {
  const d = getDeal(dealId);
  if (!d) throw new Error('deal_not_found');
  if (d.state === 'confirmed') return d;
  if (d.state !== 'pending_governance') throw new Error('not_pending_governance');
  const entry = _otps.get(d.id);
  if (!entry) throw new Error('otp_expired');
  if (Date.now() > entry.expiresAt) { _otps.delete(d.id); throw new Error('otp_expired'); }
  const got = String(otp || '');
  // Timing-safe compare.
  if (got.length !== entry.otp.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(entry.otp))) {
    throw new Error('otp_invalid');
  }
  _otps.delete(d.id);
  d.state = 'confirmed';
  d.confirmedAt = new Date().toISOString();
  d.history.push({ at: d.confirmedAt, actor: 'governance', action: 'confirm' });
  d.updatedAt = d.confirmedAt;
  // Generate a signed contract via the contract generator (if present).
  try {
    const cg = _contracts();
    if (cg && typeof cg.create === 'function') {
      const contract = cg.create(d);
      d.contractId = contract.id;
      d.contractUrl = '/api/enterprise/contract/' + d.id;
    }
  } catch (e) { console.warn('[negotiation] contract gen failed:', e.message); }
  // Audit + revenue-vault allocation.
  try {
    const g = _governance();
    if (g && typeof g.recordAudit === 'function') g.recordAudit({ kind: 'deal_confirm', dealId: d.id, priceUSD: d.acceptedPriceUSD });
  } catch (_) {}
  try {
    const v = require('./revenue-vault');
    if (v && typeof v.allocateForDeal === 'function') v.allocateForDeal(d);
  } catch (_) {}
  _persist(d);
  return d;
}

function _resetForTests() {
  _deals.clear();
  _otps.clear();
  try { fs.rmSync(LOG_FILE, { force: true }); } catch (_) {}
}

// Test helper: read OTP for a deal (NEVER expose via HTTP).
function _peekOtp(dealId) { const e = _otps.get(String(dealId||'')); return e ? e.otp : null; }

_hydrate();

module.exports = { startDeal, counter, accept, confirmGovernance, getDeal, listDeals, _resetForTests, _peekOtp };
