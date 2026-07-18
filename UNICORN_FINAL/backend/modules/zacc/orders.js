// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Order store.
// RO: sursa-de-adevăr pentru comenzile de dropship. Ține fiecare comandă cu
// contactul cumpărătorului, adresa de livrare, factura BTC, marja și un
// timeline auditabil. Persistat pe disc (data/zacc/orders.json, mode 0600,
// scriere throttlată + atomică). Nu aruncă niciodată în bucla autonomă.
//
// Lifecycle: created → awaiting_payment → paid → fulfillment_queued |
//            fulfillment_routed → shipped ; plus cancelled | expired.

'use strict';

const fs = require('fs');
const path = require('path');
const { now, round2, logger } = require('./util');

const log = logger('orders');

const STORE_FILE = process.env.ZACC_ORDERS_FILE
  || path.join(__dirname, '..', '..', '..', 'data', 'zacc', 'orders.json');
const PERSIST_MIN_INTERVAL_MS = Number(process.env.ZACC_ORDERS_PERSIST_MS || 3000);
const MAX_ORDERS = Number(process.env.ZACC_ORDERS_MAX || 5000);

const STATUSES = [
  'created', 'awaiting_payment', 'paid',
  'fulfillment_queued', 'fulfillment_routed', 'shipped',
  'cancelled', 'expired',
];

function newToken() {
  return 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

class OrderStore {
  constructor(opts) {
    opts = opts || {};
    this.orders = [];             // newest-first
    this.byToken = new Map();     // token → order
    this.byInvoiceId = new Map(); // invoiceId → order
    this.created = 0;
    this._lastPersistAt = 0;
    this._persistTimer = null;
    this._file = opts.file || STORE_FILE;
    this._persistMinIntervalMs = Number.isFinite(opts.persistMs) ? opts.persistMs : PERSIST_MIN_INTERVAL_MS;
    this._autoPersist = opts.autoPersist !== false; // disable in tests via {autoPersist:false}
  }

  // ---- Mutations -------------------------------------------------------

  create(input) {
    input = input || {};
    const token = newToken();
    const order = {
      token,
      productId: input.productId || null,
      productTitle: input.productTitle || input.productId || 'ZACC dropship product',
      email: input.email || null,
      shipping: input.shipping || null,
      qty: Math.max(1, Number(input.qty) || 1),
      amountUsd: round2(Number(input.amountUsd) || 0),
      shippingUsd: round2(Number(input.shippingUsd) || 0),
      marginUsd: round2(Number(input.marginUsd) || 0),
      addonUsd: round2(Number(input.addonUsd) || 0),
      addons: Array.isArray(input.addons) ? input.addons.slice(0, 3) : [],
      invoiceId: input.invoiceId || null,
      demoOnly: input.demoOnly !== false,
      status: 'created',
      fulfilment: null,
      carrier: null,
      trackingNumber: null,
      txid: null,
      timeline: [],
      createdAt: now(),
      updatedAt: now(),
      paidAt: null,
      shippedAt: null,
    };
    this._appendTimeline(order, 'created', {
      productId: order.productId, qty: order.qty, amountUsd: order.amountUsd,
    });
    if (order.invoiceId) this.byInvoiceId.set(order.invoiceId, order);
    this.orders.unshift(order);
    if (this.orders.length > MAX_ORDERS) {
      const dropped = this.orders.pop();
      if (dropped) { this.byToken.delete(dropped.token); if (dropped.invoiceId) this.byInvoiceId.delete(dropped.invoiceId); }
    }
    this.byToken.set(token, order);
    this.created += 1;
    this._persist();
    return order;
  }

  // Attach / update the BTC invoice id after the invoice is minted, and move
  // the order into awaiting_payment.
  linkInvoice(token, invoiceId) {
    const order = this.getByToken(token);
    if (!order || !invoiceId) return null;
    if (order.invoiceId && order.invoiceId !== invoiceId) this.byInvoiceId.delete(order.invoiceId);
    order.invoiceId = invoiceId;
    this.byInvoiceId.set(invoiceId, order);
    if (order.status === 'created') order.status = 'awaiting_payment';
    order.updatedAt = now();
    this._appendTimeline(order, 'invoice_linked', { invoiceId });
    this._persist();
    return order;
  }

  markPaid(ref, meta) {
    const order = this._resolve(ref);
    if (!order) return null;
    meta = meta || {};
    order.status = 'paid';
    order.paidAt = now();
    order.updatedAt = now();
    if (meta.txid) order.txid = meta.txid;
    this._appendTimeline(order, 'paid', { txid: meta.txid || null, amountUsd: order.amountUsd });
    this._persist();
    return order;
  }

  // Called after routing to a provider (CJ / webhook = routed; manual = queued).
  markRouted(token, fulfilment) {
    const order = this.getByToken(token);
    if (!order) return null;
    fulfilment = fulfilment || {};
    const provider = fulfilment.provider || (fulfilment.result && fulfilment.result.provider) || null;
    order.fulfilment = fulfilment;
    order.status = (provider && provider !== 'manual-queue') ? 'fulfillment_routed' : 'fulfillment_queued';
    order.updatedAt = now();
    this._appendTimeline(order, order.status, { provider });
    this._persist();
    return order;
  }

  markShipped(token, meta) {
    const order = this.getByToken(token);
    if (!order) return null;
    meta = meta || {};
    order.status = 'shipped';
    order.carrier = meta.carrier || order.carrier || null;
    order.trackingNumber = meta.number || meta.trackingNumber || order.trackingNumber || null;
    order.shippedAt = now();
    order.updatedAt = now();
    this._appendTimeline(order, 'shipped', { carrier: order.carrier, number: order.trackingNumber, note: meta.note || null });
    this._persist();
    return order;
  }

  cancel(ref, reason) {
    const order = this._resolve(ref);
    if (!order) return null;
    order.status = 'cancelled';
    order.updatedAt = now();
    this._appendTimeline(order, 'cancelled', { reason: reason || null });
    this._persist();
    return order;
  }

  appendTimeline(token, event, meta) {
    const order = this.getByToken(token);
    if (!order) return null;
    this._appendTimeline(order, event, meta || {});
    order.updatedAt = now();
    this._persist();
    return order;
  }

  _appendTimeline(order, event, meta) {
    order.timeline.push({ at: now(), event: String(event), meta: meta || {} });
    if (order.timeline.length > 200) order.timeline.shift();
  }

  // ---- Reads -----------------------------------------------------------

  getByToken(token) { return this.byToken.get(token) || null; }
  getByInvoiceId(id) { return this.byInvoiceId.get(id) || null; }

  _resolve(ref) {
    if (!ref) return null;
    return this.getByToken(ref) || this.getByInvoiceId(ref);
  }

  list(opts) {
    const { status, limit = 100 } = opts || {};
    let items = this.orders;
    if (status) items = items.filter((o) => o.status === status);
    return items.slice(0, Math.max(0, Number(limit) || 100));
  }

  status() {
    const counts = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const o of this.orders) counts[o.status] = (counts[o.status] || 0) + 1;
    const revenuePaidUsd = round2(this.orders
      .filter((o) => ['paid', 'fulfillment_queued', 'fulfillment_routed', 'shipped'].includes(o.status))
      .reduce((s, o) => s + (Number(o.amountUsd) || 0), 0));
    return {
      ok: true,
      total: this.orders.length,
      created: this.created,
      counts,
      revenuePaidUsd,
      recent: this.orders.slice(0, 6).map((o) => ({
        token: o.token, productId: o.productId, status: o.status,
        amountUsd: o.amountUsd, email: o.email ? _maskEmail(o.email) : null, at: o.createdAt,
      })),
    };
  }

  // Public "order passport" (safe to expose without admin auth).
  publicView(token) {
    const o = this.getByToken(token);
    if (!o) return null;
    return {
      token: o.token,
      productId: o.productId,
      productTitle: o.productTitle,
      qty: o.qty,
      amountUsd: o.amountUsd,
      shippingUsd: o.shippingUsd,
      status: o.status,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      invoiceId: o.invoiceId,
      email: o.email ? _maskEmail(o.email) : null,
      demoOnly: o.demoOnly,
      timeline: o.timeline,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      shippedAt: o.shippedAt,
    };
  }

  // ---- Persistence -----------------------------------------------------

  toState() { return { orders: this.orders.slice(0, MAX_ORDERS), created: this.created }; }

  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.orders)) {
      this.orders = s.orders.slice(0, MAX_ORDERS);
      this.byToken.clear();
      this.byInvoiceId.clear();
      for (const o of this.orders) {
        if (!o || !o.token) continue;
        this.byToken.set(o.token, o);
        if (o.invoiceId) this.byInvoiceId.set(o.invoiceId, o);
      }
    }
    if (Number.isFinite(s.created)) this.created = s.created;
  }

  // Load durable state from disk (fail-soft). Called once at boot by the store.
  restore() {
    try {
      if (!fs.existsSync(this._file)) return false;
      const raw = fs.readFileSync(this._file, 'utf8');
      if (!raw || !raw.trim()) return false;
      const parsed = JSON.parse(raw);
      this.fromState(parsed && parsed.state ? parsed.state : parsed);
      log.info('orders restored ·', this.orders.length);
      return true;
    } catch (e) { log.warn('orders restore skipped:', e.message); return false; }
  }

  // Throttled, atomic write with 0600 perms. Never throws into the loop.
  _persist(force) {
    if (!this._autoPersist) return false;
    if (!force && Date.now() - this._lastPersistAt < this._persistMinIntervalMs) {
      // Coalesce: schedule a trailing flush so nothing is lost.
      if (!this._persistTimer) {
        this._persistTimer = setTimeout(() => { this._persistTimer = null; this._persist(true); }, this._persistMinIntervalMs);
        if (typeof this._persistTimer.unref === 'function') this._persistTimer.unref();
      }
      return false;
    }
    this._lastPersistAt = Date.now();
    return this.flush();
  }

  flush() {
    try {
      const dir = path.dirname(this._file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const payload = JSON.stringify({ savedAt: now(), state: this.toState() });
      const tmp = this._file + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmp, this._file);
      try { fs.chmodSync(this._file, 0o600); } catch (_) { /* best-effort */ }
      return true;
    } catch (e) { log.warn('orders save skipped:', e.message); return false; }
  }
}

function _maskEmail(email) {
  const s = String(email);
  const at = s.indexOf('@');
  if (at <= 1) return '***' + s.slice(at);
  return s[0] + '***' + s.slice(at);
}

module.exports = { OrderStore, STATUSES, STORE_FILE };
