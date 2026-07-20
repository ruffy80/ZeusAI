// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Fulfillment Router + Zeus Fulfillment Desk.
// RO: după ce un BTC invoice se confirmă on-chain (event "order paid"),
// această componentă rutează comanda către furnizorul real:
//   1) CJ Dropshipping API (când ZACC_CJ_API_KEY e setat) — automat;
//   2) Webhook generic (ZACC_FULFILL_WEBHOOK_URL) — pentru orice alt furnizor;
//   3) Zeus Fulfillment Desk — coadă durabilă + alertă owner (email outbox /
//      Telegram) — nicio comandă nu se pierde fără CJ.
// Nu blochează niciodată bucla; orice eroare e capturată și raportată.

'use strict';

const fs = require('fs');
const path = require('path');
const { now, shortId, logger } = require('./util');
const notify = require('./notify');
const cjApi = require('./cj-api');

const log = logger('fulfillment');

function _cjKey() { return String(process.env.ZACC_CJ_API_KEY || '').trim(); }
function _cjEndpoint() {
  return process.env.ZACC_CJ_ENDPOINT || 'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder';
}
const FULFILL_WEBHOOK = () => process.env.ZACC_FULFILL_WEBHOOK_URL || '';
const ADMIN_EMAIL = () => process.env.ZACC_ADMIN_EMAIL || process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const FETCH_TIMEOUT_MS = 6000;

const DESK_DIR = process.env.ZACC_FULFILL_DIR
  || path.join(__dirname, '..', '..', '..', 'data', 'zacc');
const DESK_FILE = path.join(DESK_DIR, 'fulfillment-desk.json');

const CJ_SETUP_URL = 'https://cjdropshipping.com → My CJ → Authorization → API → Generate API Key';

class FulfillmentRouter {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.orders = [];          // all routed orders (newest-first)
    this.pendingOrders = [];   // orders awaiting desk / CJ
    this.maxOrders = 500;
    this.routed = 0;
    this.autoFulfilled = 0;
    this.manualQueued = 0;
    this.errors = 0;
    this.lastRouteAt = 0;
    this.lastReprocessAt = 0;
    this._loadDesk();
  }

  _loadDesk() {
    try {
      if (!fs.existsSync(DESK_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(DESK_FILE, 'utf8'));
      if (Array.isArray(raw.pendingOrders)) this.pendingOrders = raw.pendingOrders.slice(0, 100);
      if (Array.isArray(raw.orders)) this.orders = raw.orders.slice(0, this.maxOrders);
      if (Number.isFinite(raw.routed)) this.routed = raw.routed;
      if (Number.isFinite(raw.autoFulfilled)) this.autoFulfilled = raw.autoFulfilled;
      if (Number.isFinite(raw.manualQueued)) this.manualQueued = raw.manualQueued;
    } catch (e) {
      log.warn('desk load failed:', e.message);
    }
  }

  _persistDesk() {
    try {
      fs.mkdirSync(DESK_DIR, { recursive: true });
      const tmp = DESK_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({
        updatedAt: now(),
        pendingOrders: this.pendingOrders.slice(0, 100),
        orders: this.orders.slice(0, 100),
        routed: this.routed,
        autoFulfilled: this.autoFulfilled,
        manualQueued: this.manualQueued,
      }, null, 2));
      fs.renameSync(tmp, DESK_FILE);
    } catch (e) {
      log.warn('desk persist failed:', e.message);
    }
  }

  async _viaCjDropshipping(order) {
    const CJ_API_KEY = _cjKey();
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
      const r = await fetch(_cjEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': CJ_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.result === false) return { ok: false, reason: 'cj_error', details: data };
      const cjOrderId = (data.data && (data.data.orderId || data.data.cjOrderId)) || null;
      return {
        ok: true,
        provider: 'cj-dropshipping',
        externalId: cjOrderId,
        cjOrderId,
      };
    } catch (e) { return { ok: false, reason: 'cj_exception', message: e.message }; }
  }

  // Poll CJ for shipping tracking of every routed CJ order. Returns a summary
  // and applies each result to the caller-provided orderStore (so the buyer
  // passport sees fresh events). Fail-honest — never throws.
  async pollCjTracking(orderStore) {
    if (!cjApi.isConfigured()) return { ok: true, polled: 0, reason: 'cj_not_configured' };
    let polled = 0; let updated = 0;
    const results = [];
    for (const order of this.orders.slice(0, 100)) {
      const r = order && order.result;
      if (!r || r.provider !== 'cj-dropshipping' || !r.cjOrderId) continue;
      polled += 1;
      const detail = await cjApi.queryOrderDetail(r.cjOrderId);
      let tracking = null;
      if (detail && detail.ok && detail.trackNumber) {
        tracking = await cjApi.queryTracking(detail.trackNumber);
        if (tracking && tracking.ok) {
          tracking.carrier = tracking.carrier || detail.carrier || null;
        }
      }
      if (tracking && tracking.ok && orderStore && order.orderToken) {
        orderStore.attachTracking(order.orderToken, tracking);
        updated += 1;
      }
      results.push({
        orderId: order.id,
        orderToken: order.orderToken,
        cjOrderId: r.cjOrderId,
        status: detail && detail.ok ? detail.status : null,
        trackNumber: detail && detail.ok ? detail.trackNumber : null,
        events: tracking && tracking.ok ? tracking.events.length : 0,
      });
    }
    return { ok: true, polled, updated, results };
  }

  async _viaWebhook(order) {
    const url = FULFILL_WEBHOOK();
    if (!url || typeof fetch !== 'function') return { ok: false, reason: 'webhook_not_configured' };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'zacc.order', order }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!r.ok) return { ok: false, reason: 'webhook_status_' + r.status };
      return { ok: true, provider: 'webhook' };
    } catch (e) { return { ok: false, reason: 'webhook_exception', message: e.message }; }
  }

  // Zeus Fulfillment Desk — durable queue + owner alert. No order is lost.
  _queueDesk(order, lastReason) {
    order.queuedAt = now();
    order.queueReason = lastReason || 'no_automatic_provider';
    order.desk = 'zeus-fulfillment-desk';
    // de-dupe by id
    this.pendingOrders = this.pendingOrders.filter((o) => o.id !== order.id);
    this.pendingOrders.unshift(order);
    if (this.pendingOrders.length > 100) this.pendingOrders.pop();
    this.manualQueued += 1;
    log.warn('FULFILLMENT DESK · ' + order.id + ' · ' + order.productTitle + ' · contact ' + ADMIN_EMAIL());
    try {
      notify.orderManualNeeded({
        orderToken: order.orderToken || order.id,
        productTitle: order.productTitle,
        qty: order.qty,
        amountUsd: order.amountUsd,
        email: order.email,
        reason: order.queueReason,
        shipping: order.shipping,
      });
    } catch (_) { /* fail-soft */ }
    this._persistDesk();
    return { ok: true, provider: 'zeus-fulfillment-desk', adminEmail: ADMIN_EMAIL(), setup: CJ_SETUP_URL };
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

    let result = await this._viaCjDropshipping(order);
    if (!result.ok) result = await this._viaWebhook(order);
    if (!result.ok) result = this._queueDesk(order, result.reason);
    else {
      this.autoFulfilled += 1;
      this._persistDesk();
    }

    order.result = result;
    this.orders.unshift(order);
    if (this.orders.length > this.maxOrders) this.orders.pop();
    this._persistDesk();
    log.info('routed order', order.id, '→', result.provider || result.reason);
    return { ok: true, order };
  }

  // When a CJ key is armed later, retry desk queue for CJ-eligible orders.
  async reprocessPending() {
    this.lastReprocessAt = Date.now();
    if (!_cjKey()) return { ok: true, retried: 0, reason: 'cj_not_configured' };
    let retried = 0;
    let routed = 0;
    const still = [];
    for (const order of this.pendingOrders.slice()) {
      retried += 1;
      const result = await this._viaCjDropshipping(order);
      if (result.ok) {
        order.result = result;
        order.resolvedAt = now();
        order.resolvedVia = 'cj-reprocess';
        this.autoFulfilled += 1;
        routed += 1;
        this.orders.unshift(order);
      } else {
        still.push(order);
      }
    }
    this.pendingOrders = still;
    this._persistDesk();
    return { ok: true, retried, routed, stillPending: still.length };
  }

  resolvePending(orderId) {
    const idx = this.pendingOrders.findIndex(o => o.id === orderId);
    if (idx < 0) return null;
    const [done] = this.pendingOrders.splice(idx, 1);
    done.resolvedAt = now();
    this._persistDesk();
    return done;
  }

  readiness() {
    const hasCj = !!_cjKey();
    return {
      ok: true,
      mode: hasCj ? 'cj-dropship' : 'zeus-fulfillment-desk',
      cjConfigured: hasCj,
      webhookConfigured: !!FULFILL_WEBHOOK(),
      adminEmail: ADMIN_EMAIL(),
      pending: this.pendingOrders.length,
      deskFile: DESK_FILE,
      howToGetCjKey: {
        steps: [
          'Create a free account at https://cjdropshipping.com',
          'My CJ → Authorization → API → Generate API Key',
          'On the VPS run: bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh \'YOUR_KEY\'',
          'Or POST /api/dropship/fulfillment/arm-cj with admin auth { "apiKey": "..." }',
        ],
        docs: 'https://developers.cjdropshipping.com/en/summary/course.html',
      },
      note: hasCj
        ? 'CJ key armed — eligible SKUs with supplierRef auto-dispatch.'
        : 'No CJ key on server (cannot be invented). Storefront + BTC + desk queue are live; physical supplier dispatch arms when you paste a real CJ API key.',
    };
  }

  status() {
    const ready = this.readiness();
    return {
      ok: true,
      routed: this.routed,
      autoFulfilled: this.autoFulfilled,
      manualQueued: this.manualQueued,
      errors: this.errors,
      lastRouteAt: this.lastRouteAt ? new Date(this.lastRouteAt).toISOString() : null,
      lastReprocessAt: this.lastReprocessAt ? new Date(this.lastReprocessAt).toISOString() : null,
      pending: this.pendingOrders.length,
      providers: {
        cjDropshipping: !!_cjKey(),
        webhook: !!FULFILL_WEBHOOK(),
        zeusFulfillmentDesk: true,
        adminEmail: ADMIN_EMAIL(),
      },
      mode: ready.mode,
      readiness: ready,
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
    this._persistDesk();
  }
}

module.exports = { FulfillmentRouter, CJ_SETUP_URL };
