// commerce/revenue-vault.js
// Tracks revenue allocations + per-channel splits. Settles via webhook txRefs.
//
// Allocation:
//   { id, dealId?, totalUSD, splits: [{ id, channel, amountUSD, settled, txRef, settledAt }], createdAt }
//
// Exports:
//   allocate({totalUSD, dealId?, splits:[{channel,percent|amountUSD}]}) → allocation
//   allocateForDeal(deal) → allocation                 (default split: 70% BTC, 30% PayPal)
//   findUnsettledSplit(dealId, channel) → { allocId, splitId } | null
//   settle(allocId, splitId, txRef) → split entry
//   snapshot() → { allocations, totalUSD, settledUSD, pendingUSD, byChannel }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const LOG_FILE = path.join(DATA_DIR, 'revenue-vault.jsonl');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

const _allocs = new Map();
function _hydrate() {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return;
  try {
    const text = fs.readFileSync(LOG_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      try {
        const evt = JSON.parse(t);
        if (evt.type === 'snapshot' && evt.alloc) _allocs.set(evt.alloc.id, evt.alloc);
      } catch (_) {}
    }
  } catch (e) { console.warn('[vault] hydrate failed:', e.message); }
}
function _persist(alloc) {
  ensureDir();
  try { fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), type: 'snapshot', alloc }) + '\n'); }
  catch (e) { console.warn('[vault] persist failed:', e.message); }
}

function allocate(opts) {
  const total = Number((opts && opts.totalUSD) || 0);
  if (!(total > 0)) throw new Error('totalUSD_required');
  const splits = Array.isArray(opts && opts.splits) ? opts.splits : [{ channel: 'BTC', percent: 1 }];
  const id = 'alloc_' + crypto.randomBytes(8).toString('hex');
  const out = {
    id,
    dealId: (opts && opts.dealId) || null,
    totalUSD: total,
    createdAt: new Date().toISOString(),
    splits: splits.map(s => ({
      id: 'split_' + crypto.randomBytes(6).toString('hex'),
      channel: String(s.channel || 'BTC'),
      amountUSD: s.amountUSD != null ? Number(s.amountUSD) : Number((Number(s.percent || 0) * total).toFixed(2)),
      settled: false,
      txRef: null,
      settledAt: null
    }))
  };
  _allocs.set(out.id, out);
  _persist(out);
  return out;
}

function allocateForDeal(deal) {
  const total = Number((deal && (deal.acceptedPriceUSD || deal.currentOfferUSD || deal.listPriceUSD)) || 0);
  if (!(total > 0)) throw new Error('deal_price_required');
  // Default split: 70% BTC, 30% PayPal — overridable by env.
  const btcPct = Math.min(1, Math.max(0, Number(process.env.VAULT_BTC_PCT || 0.7)));
  const ppPct = Math.max(0, 1 - btcPct);
  return allocate({
    totalUSD: total,
    dealId: deal.id,
    splits: [
      { channel: 'BTC', percent: btcPct },
      { channel: 'PayPal', percent: ppPct }
    ].filter(s => s.percent > 0)
  });
}

function findUnsettledSplit(dealId, channel) {
  const ch = String(channel || '');
  for (const alloc of _allocs.values()) {
    if (dealId && alloc.dealId !== dealId) continue;
    const s = alloc.splits.find(x => !x.settled && x.channel === ch);
    if (s) return { allocId: alloc.id, splitId: s.id };
  }
  return null;
}

function settle(allocId, splitId, txRef) {
  const alloc = _allocs.get(String(allocId || ''));
  if (!alloc) throw new Error('alloc_not_found');
  const s = alloc.splits.find(x => x.id === splitId);
  if (!s) throw new Error('split_not_found');
  if (s.settled) return s;
  s.settled = true;
  s.txRef = String(txRef || '').slice(0, 200);
  s.settledAt = new Date().toISOString();
  _persist(alloc);
  return s;
}

function snapshot() {
  const allocations = Array.from(_allocs.values());
  const byChannel = {};
  let totalUSD = 0, settledUSD = 0;
  for (const a of allocations) {
    totalUSD += Number(a.totalUSD || 0);
    for (const s of a.splits) {
      const k = s.channel || 'unknown';
      byChannel[k] = byChannel[k] || { totalUSD: 0, settledUSD: 0, pendingUSD: 0, splits: 0, settled: 0 };
      byChannel[k].totalUSD += Number(s.amountUSD || 0);
      byChannel[k].splits += 1;
      if (s.settled) {
        byChannel[k].settledUSD += Number(s.amountUSD || 0);
        byChannel[k].settled += 1;
        settledUSD += Number(s.amountUSD || 0);
      } else {
        byChannel[k].pendingUSD += Number(s.amountUSD || 0);
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    allocations: allocations.length,
    totalUSD: Number(totalUSD.toFixed(2)),
    settledUSD: Number(settledUSD.toFixed(2)),
    pendingUSD: Number((totalUSD - settledUSD).toFixed(2)),
    byChannel
  };
}

function _resetForTests() {
  _allocs.clear();
  try { fs.rmSync(LOG_FILE, { force: true }); } catch (_) {}
}

_hydrate();

module.exports = { allocate, allocateForDeal, findUnsettledSplit, settle, snapshot, _resetForTests };
