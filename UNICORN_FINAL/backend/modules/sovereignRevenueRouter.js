// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-30T15:05:08.929Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/*
 * sovereignRevenueRouter
 * ----------------------
 * Additive revenue-router — books revenue events into an in-memory ledger and
 * routes settlement to the owner's BTC wallet (LEGAL_OWNER_BTC). Designed to
 * unblock /api/revenue/* endpoints in backend/index.js without depending on
 * any external state (DB / network); ledger persists to data/ for forensics.
 *
 * Router de venituri — adițional, ne-distructiv. Înregistrează evenimente de
 * venit într-un registru in-memory + JSONL append-only și le direcționează
 * spre adresa BTC a proprietarului. Niciun rollback al endpoint-urilor.
 */

const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

const OWNER_BTC = process.env.LEGAL_OWNER_BTC
  || process.env.ADMIN_OWNER_BTC
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const PLATFORM_FEE_PCT = Math.max(0, Math.min(1, parseFloat(process.env.PLATFORM_FEE_PCT || '0.15')));

const DATA_DIR  = path.resolve(__dirname, '..', '..', 'data', 'revenue');
const LEDGER    = path.join(DATA_DIR, 'sovereign-revenue-ledger.jsonl');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* tolerate read-only fs */ }
}

const _events = [];
const _maxInMemory = 5000;
const _totals = {
  count: 0,
  grossUsd: 0,
  feeUsd: 0,
  payoutUsd: 0,
  byChannel: {},
};

function _persist(evt) {
  ensureDir();
  try { fs.appendFileSync(LEDGER, JSON.stringify(evt) + '\n', 'utf8'); } catch (_) { /* tolerate fs */ }
}

function route(input = {}) {
  const amountUsd = Number(input.amountUsd || input.amount || 0);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { ok: false, error: 'amountUsd must be a positive number' };
  }
  const channel = String(input.channel || input.source || 'direct').slice(0, 64);
  const tenantId = String(input.tenantId || input.tenant || 'self').slice(0, 64);
  const productId = String(input.productId || input.product || 'unspecified').slice(0, 96);
  const feeUsd = Math.round(amountUsd * PLATFORM_FEE_PCT * 100) / 100;
  const payoutUsd = Math.round((amountUsd - feeUsd) * 100) / 100;
  const evt = {
    id: 'rev_' + crypto.randomBytes(8).toString('hex'),
    ts: new Date().toISOString(),
    channel,
    tenantId,
    productId,
    amountUsd,
    feeUsd,
    payoutUsd,
    payout: { rail: 'btc-direct', btcAddress: OWNER_BTC },
    receipt: input.receipt ? String(input.receipt).slice(0, 256) : null,
  };
  _events.push(evt);
  if (_events.length > _maxInMemory) _events.shift();
  _totals.count += 1;
  _totals.grossUsd = Math.round((_totals.grossUsd + amountUsd) * 100) / 100;
  _totals.feeUsd = Math.round((_totals.feeUsd + feeUsd) * 100) / 100;
  _totals.payoutUsd = Math.round((_totals.payoutUsd + payoutUsd) * 100) / 100;
  _totals.byChannel[channel] = (_totals.byChannel[channel] || 0) + amountUsd;
  _persist(evt);
  return { ok: true, event: evt };
}

function totals() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    payout: { rail: 'btc-direct', btcAddress: OWNER_BTC, platformFeePct: PLATFORM_FEE_PCT },
    ..._totals,
  };
}

function recent(limit = 20) {
  const n = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
  return _events.slice(-n).reverse();
}

function verifyReceipt(input = {}) {
  const id = String(input.id || input.receiptId || '').slice(0, 64);
  if (!id) return { ok: false, error: 'id required' };
  const evt = _events.find((e) => e.id === id);
  if (!evt) return { ok: false, verified: false, error: 'event not found' };
  return { ok: true, verified: true, event: evt };
}

function getStatus() {
  return {
    ok: true,
    name: 'sovereignRevenueRouter',
    payout: { rail: 'btc-direct', btcAddress: OWNER_BTC, platformFeePct: PLATFORM_FEE_PCT },
    totalEvents: _totals.count,
    grossUsd: _totals.grossUsd,
    payoutUsd: _totals.payoutUsd,
    channels: Object.keys(_totals.byChannel),
  };
}

module.exports = { route, totals, recent, verifyReceipt, getStatus };
