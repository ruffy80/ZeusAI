// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:29:34.260Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * btcInvoiceLedger — single-address invoicing with satoshi-suffix disambiguation.
 *
 * Strategy:
 *   - All revenue goes to ADMIN_OWNER_BTC (single static address).
 *   - Each invoice gets a unique amount: baseSats + (invoiceId % 99999).
 *   - The verifier matches incoming on-chain transactions by exact sats value,
 *     so we always know which invoice was paid — without managing keys/xpubs.
 *
 * Persistence: BTC_INVOICE_DATA_DIR or data/invoices/<id>.json + _index.jsonl
 *
 * Env:
 *   ADMIN_OWNER_BTC    — payout address (same as backend/index.js)
 *   BTC_FX_OVERRIDE    — optional fixed USD/BTC rate (otherwise fetched)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR    = process.env.BTC_INVOICE_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'invoices');
const INDEX_FILE  = path.join(DATA_DIR, '_index.jsonl');
const COUNTER_FILE = path.join(DATA_DIR, '_counter.json');

const PAYOUT_ADDRESS = process.env.ADMIN_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

let _fxCache = { ts: 0, rate: 0 };

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function nextId() {
  ensureDir();
  let counter = 0;
  try {
    counter = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).counter || 0;
  } catch (_) { counter = 0; }
  counter = (counter + 1) % 99999;
  if (counter === 0) counter = 1; // never use 0 (would be indistinguishable)
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter, updated: new Date().toISOString() }));
  return counter;
}

function fetchJSON(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function getBtcUsdRate() {
  if (process.env.BTC_FX_OVERRIDE) return parseFloat(process.env.BTC_FX_OVERRIDE);
  if (Date.now() - _fxCache.ts < 60_000 && _fxCache.rate > 0) return _fxCache.rate;
  // Try mempool.space, fallback blockchain.info
  let r = await fetchJSON('https://mempool.space/api/v1/prices');
  let rate = r && r.USD ? Number(r.USD) : 0;
  if (!rate) {
    r = await fetchJSON('https://blockchain.info/ticker');
    rate = r && r.USD && r.USD.last ? Number(r.USD.last) : 0;
  }
  if (rate > 0) _fxCache = { ts: Date.now(), rate };
  return rate || _fxCache.rate || 60000; // last-resort fallback
}

function usdToSats(usd, rate) {
  // Convert USD → sats. We then add the invoice id (1..99998) as a unique
  // suffix so two invoices with the same price still get different amounts,
  // letting the verifier match each on-chain payment back to its invoice.
  const btc = usd / rate;
  return Math.round(btc * 1e8);
}

function satsToBtc(sats) {
  return (sats / 1e8).toFixed(8);
}

async function createInvoice({ service, priceUsd, customerEmail = null, metadata = {} } = {}) {
  if (!service)  throw new Error('service required');
  if (!priceUsd) throw new Error('priceUsd required');

  const rate = await getBtcUsdRate();
  const baseSats = usdToSats(priceUsd, rate);
  const id = nextId();
  const amountSats = baseSats + id;
  const amountBtc  = satsToBtc(amountSats);
  const invoice = {
    id,
    createdAt: new Date().toISOString(),
    service,
    priceUsd,
    btcRate: rate,
    payoutAddress: PAYOUT_ADDRESS,
    amountSats,
    amountBtc,
    customerEmail,
    metadata,
    status: 'pending',
    paidAt: null,
    txid: null,
    confirmations: 0,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h
  };
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(invoice, null, 2));
  fs.appendFileSync(INDEX_FILE, JSON.stringify({ id, createdAt: invoice.createdAt, amountSats, status: 'pending' }) + '\n');
  return invoice;
}

function getInvoice(id) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${Number(id)}.json`), 'utf8')); }
  catch { return null; }
}

function listInvoices({ status, limit = 100 } = {}) {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR).filter((f) => /^\d+\.json$/.test(f));
  const out = [];
  for (const f of files) {
    try {
      const inv = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      if (status && inv.status !== status) continue;
      out.push(inv);
    } catch (_) { /* skip */ }
  }
  out.sort((a, b) => b.id - a.id);
  return out.slice(0, limit);
}

function listPending() {
  return listInvoices({ status: 'pending', limit: 1000 });
}

function markPaid(id, { txid, confirmations = 1 }) {
  const inv = getInvoice(id);
  if (!inv) return null;
  if (inv.status === 'paid') return inv;
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString();
  inv.txid = txid;
  inv.confirmations = confirmations;
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(inv, null, 2));
  fs.appendFileSync(INDEX_FILE, JSON.stringify({ id, paidAt: inv.paidAt, txid, status: 'paid' }) + '\n');
  return inv;
}

function getStatus() {
  const all = listInvoices({ limit: 10_000 });
  const paid = all.filter((i) => i.status === 'paid');
  const pending = all.filter((i) => i.status === 'pending');
  const totalUsd = paid.reduce((s, i) => s + (i.priceUsd || 0), 0);
  const totalSats = paid.reduce((s, i) => s + (i.amountSats || 0), 0);
  return {
    payoutAddress: PAYOUT_ADDRESS,
    invoiceCount: all.length,
    paid: paid.length,
    pending: pending.length,
    totalRevenueUsd: totalUsd,
    totalRevenueBtc: satsToBtc(totalSats),
  };
}

module.exports = {
  createInvoice,
  getInvoice,
  listInvoices,
  listPending,
  markPaid,
  getStatus,
  getBtcUsdRate,
  PAYOUT_ADDRESS,
  usdToSats,
  satsToBtc,
};
