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
  try {
    if (portal && typeof portal._stats === 'function') {
      const s = portal._stats();
      total = Number(s.orders || 0);
    }
  } catch (_) {}
  // Receipts (paid orders) — authoritative for revenue
  const receipts = _safeReadJsonl(RECEIPTS_PATH);
  for (const r of receipts) {
    if (r && r.status === 'paid') {
      paid += 1;
      revenueUsd += Number(r.amount || 0);
    }
  }
  if (paid > total) total = paid; // receipts can outlive portal cache
  return { total, paid, revenueUsd: Math.round(revenueUsd * 100) / 100 };
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
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: 'reality-metrics (SQLite + JSONL ledgers, no Math.random)',
    customers: _customerCount(),
    orders: { total: orders.total, paid: orders.paid },
    revenue: { paidUsd: orders.revenueUsd, currency: 'USD', method: 'on-chain BTC settled to owner wallet' },
    entitlements: _entitlementCount(),
    leads: leads,
    funnel: {
      visitors: null, // not tracked yet — see /api/growth/real for explanation
      signups: _customerCount(),
      paidCustomers: orders.paid,
      conversionRate: orders.paid > 0 && _customerCount() > 0 ? Math.round((orders.paid / _customerCount()) * 10000) / 100 + '%' : null,
    },
    honesty: {
      simulated: false,
      simulationsRemoved: ['autoViralGrowth Math.random viral score', 'autoRevenue Math.random affiliate volume', 'ai-sales-closer Math.random deal value', '82 empty AdaptiveModule scaffolds'],
      whatIsMissing: orders.paid === 0 ? 'No paid orders yet — every other metric is 0 by design until first real customer.' : null,
    },
  };
}

module.exports = { snapshot, _customerCount, _orderStats, _entitlementCount, _leadStats };
