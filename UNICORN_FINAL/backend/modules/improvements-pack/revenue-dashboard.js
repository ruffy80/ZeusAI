// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.389Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/revenue-dashboard.js · #17
//
// Owner revenue dashboard — produces a CSV (and JSON) view of revenue
// split by catalog id and (when present) tenant id, sourced from the
// existing fallback receipts file plus the funnel "paid" stream.
//
// Pure additive · read-only · zero deps · zero schema changes.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const RECEIPTS_FILE = process.env.RECEIPTS_FILE || path.join(DATA_DIR, 'commerce-receipts.json');
const FUNNEL_FILE = process.env.FUNNEL_FILE || path.join(DATA_DIR, 'funnel-events.jsonl');

function _readReceipts() {
  try {
    const raw = fs.readFileSync(RECEIPTS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function _readFunnelPaid() {
  try {
    const text = fs.readFileSync(FUNNEL_FILE, 'utf8');
    const out = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        if (e && e.stage === 'paid') out.push(e);
      } catch (_) {}
    }
    return out;
  } catch (_) { return []; }
}

function buildSummary(opts) {
  const sinceMs = opts && Number.isFinite(Number(opts.sinceMs)) ? Number(opts.sinceMs) : 0;
  const cutoff = sinceMs ? (Date.now() - sinceMs) : 0;
  const receipts = _readReceipts();
  const paid = _readFunnelPaid();

  const byProduct = new Map();
  const byTenant = new Map();
  let totalUsd = 0, totalSats = 0, count = 0;

  function _addRow(productId, tenantId, amountUsd, amountSats) {
    const pid = productId || '(unknown)';
    const tid = tenantId || 'default';
    const usd = Number(amountUsd) || 0;
    const sats = Number(amountSats) || 0;
    totalUsd += usd; totalSats += sats; count++;
    const p = byProduct.get(pid) || { productId: pid, count: 0, totalUsd: 0, totalSats: 0 };
    p.count++; p.totalUsd += usd; p.totalSats += sats; byProduct.set(pid, p);
    const t = byTenant.get(tid) || { tenantId: tid, count: 0, totalUsd: 0, totalSats: 0 };
    t.count++; t.totalUsd += usd; t.totalSats += sats; byTenant.set(tid, t);
  }

  for (const r of receipts) {
    const t = Date.parse(r && r.createdAt) || Date.parse(r && r.ts) || 0;
    if (cutoff && t < cutoff) continue;
    _addRow(r.productId || r.serviceId, r.tenantId, r.amountUsd, r.amountSats);
  }
  for (const e of paid) {
    const t = Date.parse(e.ts || '') || 0;
    if (cutoff && t < cutoff) continue;
    _addRow(e.productId, e.tenantId, e.amountUsd, 0);
  }

  return {
    generatedAt: new Date().toISOString(),
    sinceMs,
    totals: { count, totalUsd: Number(totalUsd.toFixed(4)), totalSats },
    byProduct: Array.from(byProduct.values()).sort((a, b) => b.totalUsd - a.totalUsd),
    byTenant: Array.from(byTenant.values()).sort((a, b) => b.totalUsd - a.totalUsd)
  };
}

function _csvEscape(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  if (s.indexOf(',') === -1 && s.indexOf('"') === -1 && s.indexOf('\n') === -1) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCsv(summary) {
  const lines = [];
  lines.push('section,key,count,total_usd,total_sats');
  lines.push(['totals', 'all', summary.totals.count, summary.totals.totalUsd, summary.totals.totalSats].map(_csvEscape).join(','));
  for (const p of summary.byProduct) lines.push(['product', p.productId, p.count, p.totalUsd, p.totalSats].map(_csvEscape).join(','));
  for (const t of summary.byTenant) lines.push(['tenant', t.tenantId, t.count, t.totalUsd, t.totalSats].map(_csvEscape).join(','));
  return lines.join('\n') + '\n';
}

module.exports = { buildSummary, toCsv };
