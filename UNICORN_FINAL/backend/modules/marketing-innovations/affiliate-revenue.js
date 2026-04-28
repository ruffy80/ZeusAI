// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/affiliate-revenue.js
//
// Affiliate program + UTM/short-link builder + commission ledger.
//
//  - createAffiliate({ownerName, email, btcAddress?, defaultCommissionPct?})
//      → returns { code, signed }, signed = HMAC-SHA256 of code (anti-tamper)
//  - buildLink({code, target, campaign?, source?, medium?, content?})
//      → fully-formed URL with utm_* params + ?ref=<code>
//  - shorten(url) → deterministic 8-char id under /go/<id> (in-memory map)
//  - resolve(id) → original URL (for /go/<id> redirect)
//  - trackClick(code) / trackConversion({code, amountUsd, btcRateUsd?})
//      both append to data/marketing/affiliate-ledger.jsonl
//  - ledgerSummary({sinceMs?}) → per-affiliate totals: clicks, conversions,
//      revenueUsd, commissionUsd, commissionBtc, commissionSats
//  - ownerPayout({btcRateUsd}) → totals across program for OWNER (uses
//      LEGAL_OWNER_BTC env if set, else falls back to platform fee on every
//      deal: PLATFORM_FEE_PCT, default 30% of every commission goes to owner)
//
// Pure additive · zero deps.
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const LEDGER_FILE = process.env.MARKETING_AFFILIATE_FILE || path.join(DATA_DIR, 'affiliate-ledger.jsonl');
const SECRET = process.env.MARKETING_AFFILIATE_SECRET
  || process.env.AUDIT_50Y_TOKEN
  || 'unicorn-affiliate-default-secret';

const _affiliates = new Map(); // code → affiliate
const _shortlinks = new Map(); // shortId → fullUrl
const _ledger = []; // events in-memory mirror of JSONL

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true }); } catch (_) {}
}

function _persist(evt) {
  try { _ensureDir(); fs.appendFileSync(LEDGER_FILE, JSON.stringify(evt) + '\n'); } catch (_) {}
  _ledger.push(evt);
}

function _sign(code) {
  return crypto.createHmac('sha256', SECRET).update(String(code)).digest('hex').slice(0, 16);
}

/** Verify a signed code: returns the unsigned code or null on tamper. */
function verify(signed) {
  const s = String(signed || '');
  const idx = s.lastIndexOf('.');
  if (idx <= 0) return null;
  const code = s.slice(0, idx);
  const sig = s.slice(idx + 1);
  const expected = _sign(code);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch (_) { return null; }
  return code;
}

function _slugFromName(name) {
  return String(name || 'aff').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'aff';
}

/**
 * Create a new affiliate. Idempotent on email.
 */
function createAffiliate(opts) {
  const o = opts || {};
  const email = String(o.email || '').toLowerCase().trim();
  if (!email) return { ok: false, error: 'email_required' };
  for (const a of _affiliates.values()) {
    if (a.email === email) return { ok: true, affiliate: a, signed: a.code + '.' + _sign(a.code) };
  }
  const slug = _slugFromName(o.ownerName || o.name || email.split('@')[0]);
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `${slug.toUpperCase()}-${rand}`;
  const aff = {
    code,
    ownerName: String(o.ownerName || o.name || '').slice(0, 128),
    email,
    btcAddress: String(o.btcAddress || '').slice(0, 96) || null,
    commissionPct: Math.min(0.5, Math.max(0, Number(o.defaultCommissionPct || 0.2))),
    createdAt: new Date().toISOString(),
  };
  _affiliates.set(code, aff);
  _persist({ type: 'affiliate_created', ts: aff.createdAt, code, email });
  return { ok: true, affiliate: aff, signed: `${code}.${_sign(code)}` };
}

function getAffiliate(code) { return _affiliates.get(String(code)) || null; }

function listAffiliates() {
  return Array.from(_affiliates.values()).map((a) => ({ ...a }));
}

/**
 * Build a tracked UTM link.
 */
function buildLink(opts) {
  const o = opts || {};
  if (!o.target) return { ok: false, error: 'target_required' };
  let target;
  try { target = new URL(String(o.target)); }
  catch (_) { return { ok: false, error: 'invalid_target' }; }
  const code = String(o.code || '').trim();
  if (code) target.searchParams.set('ref', code);
  if (o.campaign) target.searchParams.set('utm_campaign', String(o.campaign).slice(0, 64));
  if (o.source) target.searchParams.set('utm_source', String(o.source).slice(0, 32));
  if (o.medium) target.searchParams.set('utm_medium', String(o.medium).slice(0, 32));
  if (o.content) target.searchParams.set('utm_content', String(o.content).slice(0, 64));
  if (o.term) target.searchParams.set('utm_term', String(o.term).slice(0, 64));
  return { ok: true, url: target.toString() };
}

/**
 * Create a deterministic 8-char short id for a URL.
 */
function shorten(fullUrl) {
  let url;
  try { url = new URL(String(fullUrl)); }
  catch (_) { return { ok: false, error: 'invalid_url' }; }
  const id = crypto.createHash('sha256').update(url.toString()).digest('hex').slice(0, 8);
  _shortlinks.set(id, url.toString());
  return { ok: true, shortId: id, shortPath: `/go/${id}`, target: url.toString() };
}

function resolve(shortId) {
  return _shortlinks.get(String(shortId)) || null;
}

/**
 * Track a click. Records in ledger, increments clicks, no payout effect.
 */
function trackClick(code, ctx) {
  const aff = _affiliates.get(String(code));
  if (!aff) return { ok: false, error: 'unknown_code' };
  const evt = {
    type: 'click',
    ts: new Date().toISOString(),
    code,
    ip: (ctx && ctx.ip) || null,
    ua: (ctx && ctx.ua) || null,
  };
  _persist(evt);
  return { ok: true, event: evt };
}

/**
 * Track a paid conversion. Owner platform-fee defaults to 30% of every
 * commission earned, redirected to LEGAL_OWNER_BTC.
 */
function trackConversion(opts) {
  const o = opts || {};
  const aff = _affiliates.get(String(o.code));
  if (!aff) return { ok: false, error: 'unknown_code' };
  const amountUsd = Math.max(0, Number(o.amountUsd || 0));
  const btcRateUsd = Math.max(1, Number(o.btcRateUsd || process.env.MARKETING_BTC_USD || 65000));
  const commissionPct = Math.min(0.5, Math.max(0, Number(o.commissionPct != null ? o.commissionPct : aff.commissionPct)));
  // Total commission generated by the deal.
  const commissionUsd = amountUsd * commissionPct;
  // Platform (owner) takes PLATFORM_FEE_PCT of the COMMISSION (not GMV).
  const platformFeePct = Math.min(1, Math.max(0, Number(process.env.PLATFORM_FEE_PCT || 0.3)));
  const ownerCutUsd = commissionUsd * platformFeePct;
  // Affiliate keeps the remainder.
  const affiliatePayoutUsd = Math.max(0, commissionUsd - ownerCutUsd);
  const evt = {
    type: 'conversion',
    ts: new Date().toISOString(),
    code: aff.code,
    affiliateEmail: aff.email,
    amountUsd,
    commissionPct,
    commissionUsd,
    affiliatePayoutUsd,
    ownerCutUsd,
    btcRateUsd,
    affiliateBtc: aff.btcAddress ? affiliatePayoutUsd / btcRateUsd : 0,
    affiliateSats: aff.btcAddress ? Math.round((affiliatePayoutUsd / btcRateUsd) * 1e8) : 0,
    ownerBtc: ownerCutUsd / btcRateUsd,
    ownerSats: Math.round((ownerCutUsd / btcRateUsd) * 1e8),
    ownerBtcAddress: process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  };
  _persist(evt);
  return { ok: true, event: evt };
}

/**
 * Per-affiliate ledger summary.
 */
function ledgerSummary(opts) {
  const o = opts || {};
  const sinceMs = Number(o.sinceMs) || 0;
  const byCode = new Map();
  let ownerTotalUsd = 0;
  let totalGmvUsd = 0;
  for (const e of _ledger) {
    if (sinceMs && new Date(e.ts).getTime() < sinceMs) continue;
    if (e.type !== 'click' && e.type !== 'conversion') continue;
    const code = e.code;
    if (!byCode.has(code)) byCode.set(code, { code, clicks: 0, conversions: 0, gmvUsd: 0, payoutUsd: 0, payoutBtc: 0, payoutSats: 0 });
    const row = byCode.get(code);
    if (e.type === 'click') row.clicks += 1;
    else {
      row.conversions += 1;
      row.gmvUsd += e.amountUsd || 0;
      row.payoutUsd += e.affiliatePayoutUsd || 0;
      row.payoutBtc += e.affiliateBtc || 0;
      row.payoutSats += e.affiliateSats || 0;
      ownerTotalUsd += e.ownerCutUsd || 0;
      totalGmvUsd += e.amountUsd || 0;
    }
  }
  const affiliates = Array.from(byCode.values()).sort((a, b) => b.gmvUsd - a.gmvUsd);
  const btcRate = Math.max(1, Number(process.env.MARKETING_BTC_USD || 65000));
  return {
    affiliates,
    totalGmvUsd,
    ownerTotalUsd,
    ownerTotalBtc: ownerTotalUsd / btcRate,
    ownerTotalSats: Math.round((ownerTotalUsd / btcRate) * 1e8),
    ownerBtcAddress: process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
    btcRateUsd: btcRate,
    generatedAt: new Date().toISOString(),
  };
}

function ownerPayout(opts) {
  const s = ledgerSummary(opts);
  return {
    ownerBtcAddress: s.ownerBtcAddress,
    totalUsd: s.ownerTotalUsd,
    totalBtc: s.ownerTotalBtc,
    totalSats: s.ownerTotalSats,
    btcRateUsd: s.btcRateUsd,
    sourceConversions: s.affiliates.reduce((acc, a) => acc + a.conversions, 0),
    generatedAt: s.generatedAt,
  };
}

function _resetForTests() {
  _affiliates.clear();
  _shortlinks.clear();
  _ledger.length = 0;
}

module.exports = {
  createAffiliate,
  getAffiliate,
  listAffiliates,
  buildLink,
  shorten,
  resolve,
  verify,
  trackClick,
  trackConversion,
  ledgerSummary,
  ownerPayout,
  _resetForTests,
};
