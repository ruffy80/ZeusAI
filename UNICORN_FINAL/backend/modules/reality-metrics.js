// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T15:55:13.720Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// reality-metrics.js — Real KPIs from SQLite, not Math.random()
// Single source of truth for every dashboard. If a number is here, it is
// derived from durable storage. If a number is NOT here, do NOT show it.
// Bilingual logs preserved (EN + RO).
// =====================================================================

'use strict';

const path = require('path');
const fs = require('fs');

let _portal = null;
function getPortal() {
  if (_portal !== null) return _portal;
  // Portal lives in ../../src/commerce/customer-portal (UNICORN_FINAL/src/...)
  const candidates = [
    '../../src/commerce/customer-portal',
    '../commerce/customer-portal',
  ];
  for (const c of candidates) {
    try {
      _portal = require(c);
      if (_portal) return _portal;
    } catch (_) { /* try next */ }
  }
  console.warn('[reality-metrics] portal unavailable on any candidate path');
  _portal = false;
  return null;
}

let _uaic = null;
function getUaic() {
  if (_uaic !== null) return _uaic;
  const candidates = ['../../src/commerce/uaic', '../commerce/uaic'];
  for (const c of candidates) {
    try { _uaic = require(c); if (_uaic) return _uaic; } catch (_) {}
  }
  _uaic = false;
  return null;
}

let _funnelIntel = null;
function getFunnelIntel() {
  if (_funnelIntel !== null) return _funnelIntel;
  try { _funnelIntel = require('./funnel-intelligence'); } catch (_) { _funnelIntel = false; }
  return _funnelIntel || null;
}

// Where commerce orders live (jsonl appended by sovereign-commerce/uaic).
const COMMERCE_DIR = path.resolve(__dirname, '..', '..', 'data', 'commerce');
const RECEIPTS_PATH = path.join(COMMERCE_DIR, 'uaic-receipts.jsonl');
const ENTITLEMENTS_PATH = path.join(COMMERCE_DIR, 'uaic-entitlements.jsonl');
const LEADS_PATH = path.resolve(__dirname, '..', '..', 'data', 'money-machine', 'sales-leads.jsonl');

function _safeReadJsonl(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const txt = fs.readFileSync(file, 'utf8');
    return txt.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (_) { return []; }
}

function _customerCount() {
  const portal = getPortal();
  if (!portal) return 0;
  try {
    if (typeof portal._stats === 'function') return Number(portal._stats().customers || 0);
  } catch (_) {}
  return 0;
}

function _orderStats() {
  const portal = getPortal();
  let total = 0; let paid = 0; let revenueUsd = 0;
  let testPaid = 0; let testRevenueUsd = 0;
  try {
    if (portal && typeof portal._stats === 'function') {
      const s = portal._stats();
      total = Number(s.orders || 0);
    }
  } catch (_) {}
  // Receipts (paid orders) — authoritative for revenue.
  // TRUTH GUARD 2026-06-12: deploy smoke-tests append receipts confirmed via
  // "loopback" (txid: smoke-test-loopback, email smoke@zeusai.pro). Those are
  // NOT real on-chain settlements. A receipt counts as REAL revenue only when
  // its confirmation is not loopback AND the txid looks like an actual
  // on-chain transaction id (64 hex chars). Everything else is surfaced
  // separately as testOrders so dashboards never inflate reality.
  // RO: chitanțele de smoke-test nu se mai numără ca venit real.
  const ONCHAIN_TXID = /^[0-9a-f]{64}$/i;
  const TEST_EMAIL = /^(smoke@zeusai\.pro|test@test\.com)$/i;
  const receipts = _safeReadJsonl(RECEIPTS_PATH);
  for (const r of receipts) {
    if (!r || r.status !== 'paid') continue;
    const conf = r.confirmation || {};
    const isLoopback = String(conf.by || '') === 'loopback' || String(conf.txid || '') === 'smoke-test-loopback';
    const isTestEmail = TEST_EMAIL.test(String(r.email || ''));
    const hasOnchainTx = ONCHAIN_TXID.test(String(conf.txid || ''));
    if (!isLoopback && !isTestEmail && hasOnchainTx) {
      paid += 1;
      revenueUsd += Number(r.amount || 0);
    } else {
      testPaid += 1;
      testRevenueUsd += Number(r.amount || 0);
    }
  }
  if (paid > total) total = paid; // receipts can outlive portal cache
  return {
    total,
    paid,
    revenueUsd: Math.round(revenueUsd * 100) / 100,
    testPaid,
    testRevenueUsd: Math.round(testRevenueUsd * 100) / 100,
  };
}

function _entitlementCount() {
  return _safeReadJsonl(ENTITLEMENTS_PATH).length;
}

function _leadStats() {
  const leads = _safeReadJsonl(LEADS_PATH);
  return {
    total: leads.length,
    last24h: leads.filter((l) => l && l.createdAt && (Date.now() - Date.parse(l.createdAt) < 24 * 3600 * 1000)).length,
  };
}

function snapshot() {
  const orders = _orderStats();
  const leads = _leadStats();
  // Visitors are now REAL (2026-06-12): durable sessions from
  // funnel-intelligence (sendBeacon page_view → per-day unique sessionIds).
  // RO: vizitatorii sunt numărați din sesiuni durabile, nu null.
  let fv = null;
  try { const fi = getFunnelIntel(); fv = fi ? fi.visitors() : null; } catch (_) { fv = null; }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'reality-metrics (SQLite + JSONL ledgers, no Math.random, smoke-test receipts excluded)',
    customers: _customerCount(),
    orders: { total: orders.total, paid: orders.paid },
    revenue: { paidUsd: orders.revenueUsd, currency: 'USD', method: 'on-chain BTC settled to owner wallet (verified txid only)' },
    testOrders: {
      paid: orders.testPaid,
      revenueUsd: orders.testRevenueUsd,
      note: 'Deploy smoke-test receipts (loopback confirmation, no on-chain txid). Never counted as real revenue.',
    },
    entitlements: _entitlementCount(),
    leads: leads,
    funnel: {
      visitors: fv ? fv.last30d : null,
      visitorsToday: fv ? fv.today : null,
      visitors7d: fv ? fv.last7d : null,
      visitorsSource: fv ? fv.source : 'funnel-intelligence not loaded',
      signups: _customerCount(),
      paidCustomers: orders.paid,
      conversionRate: orders.paid > 0 && _customerCount() > 0 ? Math.round((orders.paid / _customerCount()) * 10000) / 100 + '%' : null,
    },
    honesty: {
      simulated: false,
      simulationsRemoved: ['autoViralGrowth Math.random viral score', 'autoRevenue Math.random affiliate volume', 'ai-sales-closer Math.random deal value', '82 empty AdaptiveModule scaffolds', 'smoke-test loopback receipts excluded from paid revenue (2026-06-12)'],
      whatIsMissing: orders.paid === 0 ? 'No verified on-chain paid orders yet — every other metric is 0 by design until first real customer.' : null,
    },
  };
}

module.exports = { snapshot, _customerCount, _orderStats, _entitlementCount, _leadStats };
