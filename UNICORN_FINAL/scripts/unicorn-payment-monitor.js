#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const deployPath = process.env.DEPLOY_PATH || path.resolve(__dirname, '..');
const baseUrl = process.env.UNICORN_LOCAL_URL || 'http://127.0.0.1:3001';
const logFile = process.env.UNICORN_TX_LOG || '/var/log/unicorn-transactions.log';
const dataDir = process.env.UNICORN_COMMERCE_DIR || path.join(deployPath, 'data', 'commerce');
const uaicFile = path.join(dataDir, 'uaic-receipts.jsonl');
const fallbackFile = process.env.UNICORN_RECEIPTS_FILE || path.join(deployPath, 'data', 'commerce-receipts.json');
const OWNER_BTC = String(process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || '').trim();
const EXPLORER_BASES = String(
  process.env.COMMERCE_MEMPOOL_BASE
    ? [process.env.COMMERCE_MEMPOOL_BASE, process.env.COMMERCE_MEMPOOL_FALLBACKS || 'https://blockstream.info/api,https://mempool.emzy.de/api'].join(',')
    : 'https://mempool.space/api,https://blockstream.info/api,https://mempool.emzy.de/api'
)
  .split(',')
  .map((s) => String(s || '').trim().replace(/\/+$/, ''))
  .filter(Boolean);

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

function httpJson(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'unicorn-payment-monitor/1.0' } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve({ ok: true, data: JSON.parse(body), explorer: u.origin }); }
            catch { resolve({ ok: true, data: body, explorer: u.origin }); }
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: String(e && e.message || e) }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
  });
}

async function explorerGet(pathname) {
  let last = { ok: false, error: 'no_explorer' };
  for (const base of EXPLORER_BASES) {
    const r = await httpJson(`${base}${pathname.startsWith('/') ? pathname : '/' + pathname}`);
    if (r && r.ok) return Object.assign({}, r, { explorer: base });
    last = r || last;
  }
  return last;
}

async function resolveTxidFromExplorers(receipt) {
  const addr = String(receipt.receive_address || receipt.btcAddress || OWNER_BTC || '').trim();
  if (!addr) return null;
  const wantSats = Number(receipt.amount_sats || receipt.amountSats || 0)
    || Math.round(Number(receipt.amount_btc || receipt.amountBtc || 0) * 1e8);
  const r = await explorerGet(`/address/${encodeURIComponent(addr)}/txs`);
  if (!r.ok || !Array.isArray(r.data)) return null;
  for (const tx of r.data) {
    if (!tx || !tx.txid) continue;
    let outSats = 0;
    for (const vout of (tx.vout || [])) {
      if (vout && vout.scriptpubkey_address === addr) outSats += Number(vout.value || 0);
    }
    if (wantSats > 0 && outSats === wantSats) {
      log('explorer_txid_resolved', { receiptId: receipt.id, txid: tx.txid, explorer: r.explorer, outSats });
      return tx.txid;
    }
  }
  return null;
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
  let txid = receipt.txid || (receipt.confirmation && receipt.confirmation.txid) || null;
  // Production confirm is no longer a loopback fake-pay switch. The monitor
  // only submits a receipt once some chain reference exists; otherwise try
  // Esplora mirrors (mempool.space → blockstream → emzy) to resolve one.
  if (!txid) {
    try { txid = await resolveTxidFromExplorers(receipt); } catch (_) { txid = null; }
  }
  if (!txid) {
    log('payment_pending', { receiptId: receipt.id, reason: 'missing_chain_txid' });
    return;
  }
  const result = await post('/api/payments/btc/confirm', { receiptId: receipt.id, txid });
  log(result.status === 200 ? 'payment_confirmed_or_checked' : 'payment_pending', { receiptId: receipt.id, httpStatus: result.status, response: result.json || result.text });
}

(async () => {
  const receipts = [...loadUaicReceipts(), ...loadFallbackReceipts()];
  const unique = new Map();
  for (const receipt of receipts) if (receipt && receipt.id) unique.set(receipt.id, receipt);
  for (const receipt of unique.values()) {
    try { await monitorReceipt(receipt); } catch (error) { log('payment_monitor_error', { receiptId: receipt && receipt.id, error: error.message }); }
  }
  log('payment_monitor_tick', { checked: unique.size, explorers: EXPLORER_BASES });
})().catch((error) => { log('payment_monitor_fatal', { error: error.message }); process.exitCode = 1; });
