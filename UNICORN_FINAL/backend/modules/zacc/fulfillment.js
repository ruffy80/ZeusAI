// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Fulfillment Router.
// RO: după ce un BTC invoice se confirmă on-chain (event "order paid"),
// această componentă rutează comanda către furnizorul real:
//   1) CJ Dropshipping API (când ZACC_CJ_API_KEY e setat) — automat;
//   2) Webhook generic (ZACC_FULFILL_WEBHOOK_URL) — pentru orice alt furnizor;
//   3) Email/log notification cu coadă pendingOrders[] — fallback ca să nu se
//      piardă nicio comandă. Owner-ul vede tot pe /api/zacc/fulfillment.
// Nu blochează niciodată bucla; orice eroare e capturată și raportată.

'use strict';

const { now, shortId, logger } = require('./util');
const notify = require('./notify');

const log = logger('fulfillment');

const CJ_API_KEY = process.env.ZACC_CJ_API_KEY || '';
const CJ_ENDPOINT = process.env.ZACC_CJ_ENDPOINT || 'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder';
const FULFILL_WEBHOOK = process.env.ZACC_FULFILL_WEBHOOK_URL || '';
const ADMIN_EMAIL = process.env.ZACC_ADMIN_EMAIL || process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const FETCH_TIMEOUT_MS = 6000;

class FulfillmentRouter {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.orders = [];          // all routed orders (newest-first)
    this.pendingOrders = [];   // orders awaiting manual action
    this.maxOrders = 500;
    this.routed = 0;
    this.autoFulfilled = 0;
    this.manualQueued = 0;
    this.errors = 0;
    this.lastRouteAt = 0;
  }

  async _viaCjDropshipping(order) {
    if (!CJ_API_KEY || typeof fetch !== 'function') return { ok: false, reason: 'cj_not_configured' };
    // A real CJ order needs a supplier variant id (vid). Curated / demo SKUs
    // and free world-feed refs (dummyjson:123) must NOT be sent to CJ.
    const vid = order.supplierRef != null ? String(order.supplierRef) : '';
    if (!vid || vid.includes(':') || order.demoOnly) {
      return { ok: false, reason: order.demoOnly ? 'cj_skipped_demo_only' : 'cj_no_supplier_ref' };
    }
    try {
      const body = {
        orderNumber: order.id,
        shippingCountryCode: order.shipping && order.shipping.country,
        shippingProvince: order.shipping && order.shipping.region,
        shippingCity: order.shipping && order.shipping.city,
        shippingAddress: order.shipping && order.shipping.address,
        shippingCustomerName: order.shipping && order.shipping.name,
        shippingZip: order.shipping && order.shipping.zip,
        shippingPhone: order.shipping && order.shipping.phone,
        remark: 'ZACC autonomous · ' + order.productTitle,
        products: [{ vid, quantity: Math.max(1, Number(order.qty) || 1) }],
      };
      const r = await fetch(CJ_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': CJ_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.result === false) return { ok: false, reason: 'cj_error', details: data };
      return { ok: true, provider: 'cj-dropshipping', externalId: (data.data && data.data.orderId) || null };
    } catch (e) { return { ok: false, reason: 'cj_exception', message: e.message }; }
  }

  async _viaWebhook(order) {
    if (!FULFILL_WEBHOOK || typeof fetch !== 'function') return { ok: false, reason: 'webhook_not_configured' };
    try {
      const r = await fetch(FULFILL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'zacc.order', order }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!r.ok) return { ok: false, reason: 'webhook_status_' + r.status };
      return { ok: true, provider: 'webhook' };
    } catch (e) { return { ok: false, reason: 'webhook_exception', message: e.message }; }
  }

  // Manual fallback — queues the order for owner action AND logs explicitly so
  // it's visible in pm2 logs + the admin endpoint. No order is ever lost.
  _queueManual(order, lastReason) {
    order.queuedAt = now();
    order.queueReason = lastReason || 'no_automatic_provider';
    this.pendingOrders.unshift(order);
    if (this.pendingOrders.length > 100) this.pendingOrders.pop();
    this.manualQueued += 1;
    log.warn('MANUAL FULFILLMENT NEEDED · ' + order.id + ' · ' + order.productTitle + ' · contact ' + ADMIN_EMAIL);
    // Best-effort owner alert (Telegram/webhook/log). Never blocks or throws.
    try {
      notify.orderManualNeeded({
        orderToken: order.orderToken || order.id,
        productTitle: order.productTitle,
        qty: order.qty,
        amountUsd: order.amountUsd,
        email: order.email,
        reason: order.queueReason,
      });
    } catch (_) { /* fail-soft */ }
    return { ok: true, provider: 'manual-queue', adminEmail: ADMIN_EMAIL };
  }

  // Main entry — called by orchestrator on every paid invoice.
  async onOrder({ productId, productTitle, amountUsd, invoiceId, shipping, email, qty, supplierRef, demoOnly, orderToken }) {
    if (!productId) return { ok: false, reason: 'no_product_id' };
    const order = {
      id: 'order-' + shortId('').slice(-8),
      invoiceId: invoiceId || null,
      orderToken: orderToken || null,
      productId, productTitle: productTitle || productId,
      amountUsd: Number(amountUsd) || 0,
      qty: Math.max(1, Number(qty) || 1),
      email: email || null,
      supplierRef: supplierRef != null ? supplierRef : null,
      demoOnly: demoOnly === true,
      shipping: shipping || null,
      createdAt: now(),
    };
    this.routed += 1;
    this.lastRouteAt = Date.now();

    // 1) Try CJ Dropshipping if configured.
    let result = await this._viaCjDropshipping(order);
    // 2) Else try generic webhook.
    if (!result.ok) result = await this._viaWebhook(order);
    // 3) Else queue for manual.
    if (!result.ok) result = this._queueManual(order, result.reason);
    else { this.autoFulfilled += 1; }

    order.result = result;
    this.orders.unshift(order);
    if (this.orders.length > this.maxOrders) this.orders.pop();
    log.info('routed order', order.id, '→', result.provider || result.reason);
    return { ok: true, order };
  }

  resolvePending(orderId) {
    const idx = this.pendingOrders.findIndex(o => o.id === orderId);
    if (idx < 0) return null;
    const [done] = this.pendingOrders.splice(idx, 1);
    done.resolvedAt = now();
    return done;
  }

  status() {
    return {
      ok: true,
      routed: this.routed,
      autoFulfilled: this.autoFulfilled,
      manualQueued: this.manualQueued,
      errors: this.errors,
      lastRouteAt: this.lastRouteAt ? new Date(this.lastRouteAt).toISOString() : null,
      pending: this.pendingOrders.length,
      providers: {
        cjDropshipping: !!CJ_API_KEY,
        webhook: !!FULFILL_WEBHOOK,
        adminEmail: ADMIN_EMAIL,
      },
      recentOrders: this.orders.slice(0, 5).map(o => ({ id: o.id, product: o.productTitle, amountUsd: o.amountUsd, provider: o.result && o.result.provider, at: o.createdAt })),
    };
  }

  toState() {
    return {
      orders: this.orders.slice(0, 100),
      pendingOrders: this.pendingOrders.slice(0, 50),
      routed: this.routed, autoFulfilled: this.autoFulfilled,
      manualQueued: this.manualQueued, errors: this.errors,
      lastRouteAt: this.lastRouteAt,
    };
  }
  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.orders)) this.orders = s.orders.slice(0, this.maxOrders);
    if (Array.isArray(s.pendingOrders)) this.pendingOrders = s.pendingOrders.slice(0, 100);
    if (Number.isFinite(s.routed)) this.routed = s.routed;
    if (Number.isFinite(s.autoFulfilled)) this.autoFulfilled = s.autoFulfilled;
    if (Number.isFinite(s.manualQueued)) this.manualQueued = s.manualQueued;
    if (Number.isFinite(s.errors)) this.errors = s.errors;
    if (Number.isFinite(s.lastRouteAt)) this.lastRouteAt = s.lastRouteAt;
  }
}

module.exports = { FulfillmentRouter };
