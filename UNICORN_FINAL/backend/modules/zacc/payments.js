// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — real BTC payment verification (invoice watcher).
// RO: confirmă plățile pe blockchain, nu doar promite livrarea. Fiecare
// comandă primește o factură cu o sumă BTC UNICĂ (preț + un mic offset în
// satoshi) către adresa owner-ului. Watcher-ul interoghează mempool.space
// pentru tranzacțiile primite pe adresă și potrivește suma exactă cu o
// factură deschisă → marchează "paid" → declanșează livrarea + încasarea.
//
// De ce sume unice? Toate produsele folosesc o singură adresă BTC (a
// owner-ului). Offset-ul unic în satoshi face fiecare factură distinctă, deci
// putem atribui o plată unui produs fără adrese derivate. ToS-friendly: doar
// citește un API public (mempool.space), nu scrape, nu blochează bucla.

'use strict';

const { OWNER_BTC, now, round2, logger } = require('./util');

const log = logger('payments');

const SATS_PER_BTC = 1e8;
const RATE_TTL_MS = 5 * 60 * 1000;          // BTC/USD spot cache
const POLL_INTERVAL_MS = Number(process.env.ZACC_PAYMENT_POLL_MS || 90 * 1000);
const INVOICE_TTL_MS = Number(process.env.ZACC_INVOICE_TTL_MS || 60 * 60 * 1000); // 1h
const MEMPOOL_API = (process.env.ZACC_MEMPOOL_API || 'https://mempool.space/api').replace(/\/+$/, '');

class BtcPayments {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.address = OWNER_BTC;
    this.invoices = [];          // { id, productId, amountUsd, amountSats, amountBtc, status, txid, createdAt, expiresAt, paidAt }
    this.maxInvoices = 2000;
    this.seenTxids = {};         // txid -> true (avoid double-credit)
    this.rateUsd = 0;
    this.rateAt = 0;
    this.lastPollAt = 0;
    this.polls = 0;
    this._offsetSeq = 0;
    this.enabled = process.env.ZACC_PAYMENTS !== '0';
  }

  // Best-effort BTC/USD spot. Cached. Never throws.
  async _rate() {
    if (this.rateUsd > 0 && Date.now() - this.rateAt < RATE_TTL_MS) return this.rateUsd;
    if (typeof fetch !== 'function') return this.rateUsd || 0;
    try {
      const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', { signal: AbortSignal.timeout(3500) });
      const j = await r.json();
      const v = parseFloat(j && j.data && j.data.amount);
      if (Number.isFinite(v) && v > 0) { this.rateUsd = v; this.rateAt = Date.now(); }
    } catch (e) { log.warn('rate fetch failed:', e.message); }
    return this.rateUsd || 0;
  }

  // Create an invoice with a UNIQUE sats amount so payments to the single
  // owner address can be attributed back to this exact order.
  async createInvoice(productId, amountUsd) {
    const usd = round2(Number(amountUsd) || 0);
    const rate = await this._rate();
    let baseSats = rate > 0 ? Math.round((usd / rate) * SATS_PER_BTC) : 0;
    // Unique disambiguation offset (1..999 sats) — invisible to the buyer's
    // wallet UX but guarantees a distinct expected amount per open invoice.
    const offset = (this._offsetSeq++ % 999) + 1;
    const amountSats = baseSats > 0 ? baseSats + offset : 0;
    const inv = {
      id: 'inv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      productId,
      amountUsd: usd,
      btcRateUsd: rate,
      amountSats,
      amountBtc: amountSats > 0 ? round2(amountSats / SATS_PER_BTC * 1e8) / 1e8 : 0,
      btcAddress: this.address,
      status: rate > 0 ? 'pending' : 'rate-unavailable',
      txid: null,
      createdAt: now(),
      expiresAt: new Date(Date.now() + INVOICE_TTL_MS).toISOString(),
      paidAt: null,
    };
    this.invoices = [inv].concat(this.invoices).slice(0, this.maxInvoices);
    log.info('invoice', inv.id, 'for', productId, '·', (inv.amountSats / SATS_PER_BTC).toFixed(8), 'BTC ($' + usd + ')');
    return inv;
  }

  getInvoice(id) { return this.invoices.find(i => i.id === id) || null; }

  _openInvoices() {
    const t = Date.now();
    return this.invoices.filter(i => i.status === 'pending' && new Date(i.expiresAt).getTime() > t);
  }

  // Poll mempool.space for incoming txs to the owner address and match exact
  // sats amounts to open invoices. Throttled; only runs when invoices are open
  // (so we never hammer the public API for nothing). Never throws into loop.
  async poll(force) {
    if (!this.enabled) return { polled: false, reason: 'disabled' };
    if (!force && Date.now() - this.lastPollAt < POLL_INTERVAL_MS) return { polled: false, reason: 'throttled' };
    const open = this._openInvoices();
    // Expire stale invoices regardless.
    const tnow = Date.now();
    for (const i of this.invoices) {
      if (i.status === 'pending' && new Date(i.expiresAt).getTime() <= tnow) i.status = 'expired';
    }
    if (!open.length) { this.lastPollAt = Date.now(); return { polled: false, reason: 'no-open-invoices' }; }
    if (typeof fetch !== 'function') return { polled: false, reason: 'fetch-unavailable' };

    this.lastPollAt = Date.now();
    this.polls += 1;
    const matched = [];
    try {
      const r = await fetch(MEMPOOL_API + '/address/' + encodeURIComponent(this.address) + '/txs', { signal: AbortSignal.timeout(4500) });
      if (!r.ok) return { polled: true, matched, reason: 'http-' + r.status };
      const txs = await r.json();
      const byAmount = new Map();
      for (const inv of open) byAmount.set(inv.amountSats, inv);

      for (const tx of (Array.isArray(txs) ? txs.slice(0, 50) : [])) {
        if (!tx || this.seenTxids[tx.txid]) continue;
        // Sum outputs that pay our address.
        let received = 0;
        for (const vout of (tx.vout || [])) {
          if (vout && vout.scriptpubkey_address === this.address) received += Number(vout.value) || 0;
        }
        if (received <= 0) continue;
        const inv = byAmount.get(received);
        if (!inv) continue; // payment to address but not matching an open invoice amount
        inv.status = 'paid';
        inv.txid = tx.txid;
        inv.confirmed = !!(tx.status && tx.status.confirmed);
        inv.paidAt = now();
        this.seenTxids[tx.txid] = true;
        byAmount.delete(received);
        matched.push(inv);
        log.info('PAID invoice', inv.id, 'tx', tx.txid, inv.confirmed ? '(confirmed)' : '(mempool)');
        // Hand off to the orchestrator: record sale + trigger delivery.
        try { if (typeof this.ctx.onPaid === 'function') this.ctx.onPaid(inv); }
        catch (e) { log.warn('onPaid hook failed:', e.message); }
      }
    } catch (e) {
      log.warn('poll failed:', e.message);
      return { polled: true, matched, reason: e.message };
    }
    return { polled: true, matched, open: open.length };
  }

  status() {
    const open = this._openInvoices().length;
    const paid = this.invoices.filter(i => i.status === 'paid').length;
    return {
      ok: true,
      enabled: this.enabled,
      btcAddress: this.address,
      api: MEMPOOL_API,
      btcRateUsd: this.rateUsd,
      pollIntervalSec: Math.round(POLL_INTERVAL_MS / 1000),
      invoices: this.invoices.length,
      openInvoices: open,
      paidInvoices: paid,
      polls: this.polls,
      lastPollAt: this.lastPollAt ? new Date(this.lastPollAt).toISOString() : null,
      recent: this.invoices.slice(0, 6).map(i => ({ id: i.id, productId: i.productId, amountUsd: i.amountUsd, amountBtc: i.amountBtc, status: i.status, txid: i.txid })),
    };
  }

  // Persistence helpers.
  toState() {
    return {
      invoices: this.invoices.slice(0, 500),
      seenTxids: Object.keys(this.seenTxids).slice(0, 1000),
      offsetSeq: this._offsetSeq,
      rateUsd: this.rateUsd,
    };
  }
  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.invoices)) this.invoices = s.invoices.slice(0, this.maxInvoices);
    if (Array.isArray(s.seenTxids)) { this.seenTxids = {}; for (const t of s.seenTxids) this.seenTxids[t] = true; }
    if (Number.isFinite(s.offsetSeq)) this._offsetSeq = s.offsetSeq;
    if (Number.isFinite(s.rateUsd)) this.rateUsd = s.rateUsd;
  }
}

module.exports = { BtcPayments };
