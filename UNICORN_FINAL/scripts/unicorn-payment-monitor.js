#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const deployPath = process.env.DEPLOY_PATH || path.resolve(__dirname, '..');
const baseUrl = process.env.UNICORN_LOCAL_URL || 'http://127.0.0.1:3001';
const logFile = process.env.UNICORN_TX_LOG || '/var/log/unicorn-transactions.log';
const dataDir = process.env.UNICORN_COMMERCE_DIR || path.join(deployPath, 'data', 'commerce');
const uaicFile = path.join(dataDir, 'uaic-receipts.jsonl');
const fallbackFile = process.env.UNICORN_RECEIPTS_FILE || path.join(deployPath, 'data', 'commerce-receipts.json');

function log(event, detail) {
  const row = { ts: new Date().toISOString(), event, ...detail };
  try { fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.appendFileSync(logFile, JSON.stringify(row) + '\n'); }
  catch (_) { console.log(JSON.stringify(row)); }
}

function loadUaicReceipts() {
  const byId = new Map();
  try {
    const text = fs.readFileSync(uaicFile, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); if (r && r.id) byId.set(r.id, r); } catch (_) {}
    }
  } catch (_) {}
  return Array.from(byId.values());
}

function loadFallbackReceipts() {
  try {
    const parsed = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

async function post(pathname, body) {
  const res = await fetch(baseUrl.replace(/\/+$/, '') + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'unicorn-payment-monitor/1.0' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text: text.slice(0, 300) };
}

async function monitorReceipt(receipt) {
  const status = String(receipt.status || '').toLowerCase();
  if (!receipt || !receipt.id || status === 'paid' || status === 'cancelled' || status === 'refunded') return;
  const createdMs = Date.parse(receipt.createdAt || receipt.created_at || 0) || Date.now();
  if (Date.now() - createdMs > 60 * 60 * 1000) {
    receipt.status = 'cancelled';
    receipt.cancelledAt = new Date().toISOString();
    receipt.cancelReason = 'btc_payment_timeout_60m';
    try {
      const uaic = require(path.join(deployPath, 'src', 'commerce', 'uaic'));
      if (uaic && typeof uaic.persistReceipt === 'function') uaic.persistReceipt(receipt);
    } catch (_) {
      const list = loadFallbackReceipts();
      const idx = list.findIndex((r) => r && r.id === receipt.id);
      if (idx >= 0) list[idx] = receipt; else list.push(receipt);
      try { fs.writeFileSync(fallbackFile, JSON.stringify(list, null, 2)); } catch (_) {}
    }
    log('payment_cancelled', { receiptId: receipt.id, reason: receipt.cancelReason });
    return;
  }
  const result = await post('/api/payments/btc/confirm', { receiptId: receipt.id });
  log(result.status === 200 ? 'payment_confirmed_or_checked' : 'payment_pending', { receiptId: receipt.id, httpStatus: result.status, response: result.json || result.text });
}

(async () => {
  const receipts = [...loadUaicReceipts(), ...loadFallbackReceipts()];
  const unique = new Map();
  for (const receipt of receipts) if (receipt && receipt.id) unique.set(receipt.id, receipt);
  for (const receipt of unique.values()) {
    try { await monitorReceipt(receipt); } catch (error) { log('payment_monitor_error', { receiptId: receipt && receipt.id, error: error.message }); }
  }
  log('payment_monitor_tick', { checked: unique.size });
})().catch((error) => { log('payment_monitor_fatal', { error: error.message }); process.exitCode = 1; });
