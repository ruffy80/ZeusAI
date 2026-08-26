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
const uscf = require('./suppliers');

const log = logger('fulfillment');

function _cjKey() { return String(process.env.ZACC_CJ_API_KEY || process.env.CJ_API_KEY || '').trim(); }
const FULFILL_WEBHOOK = () => process.env.ZACC_FULFILL_WEBHOOK_URL || '';
const ADMIN_EMAIL = () => process.env.ZACC_ADMIN_EMAIL || process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';

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

  /** USCF/1.0 — route via Universal Supplier Connector Framework. */
  async _viaUscf(order) {
    try {
      return await uscf.createOrder(order);
    } catch (e) {
      return { ok: false, reason: 'uscf_exception', message: e.message };
    }
  }

  async _viaCjDropshipping(order) {
    // Backward-compatible alias — CJ lives inside USCF.
    return uscf.cj.createOrder(order);
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
    return uscf.webhook.createOrder(order);
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
  async onOrder({ productId, productTitle, amountUsd, invoiceId, shipping, email, qty, supplierRef, demoOnly, orderToken, supplier, source }) {
    if (!productId) return { ok: false, reason: 'no_product_id' };
    const order = {
      id: 'order-' + shortId('').slice(-8),
      invoiceId: invoiceId || null,
      orderToken: orderToken || null,
      productId, productTitle: productTitle || productId,
      amountUsd: Number(amountUsd) || 0,
      qty: Math.max(1, Number(qty) || 1),
      email: email || null,
      supplier: supplier || null,
      source: source || null,
      supplierRef: supplierRef != null ? supplierRef : null,
      demoOnly: demoOnly === true,
      shipping: shipping || null,
      createdAt: now(),
    };
    this.routed += 1;
    this.lastRouteAt = Date.now();

    // USCF tries CJ → Printful → Printify → webhook in priority order.
    let result = await this._viaUscf(order);
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

  // When a supplier key is armed later, retry desk queue via USCF.
  async reprocessPending() {
    this.lastReprocessAt = Date.now();
    const snap = uscf.discovery();
    if (!snap.autoShipReady) return { ok: true, retried: 0, reason: 'no_supplier_configured' };
    let retried = 0;
    let routed = 0;
    const still = [];
    for (const order of this.pendingOrders.slice()) {
      retried += 1;
      const result = await this._viaUscf(order);
      if (result.ok) {
        order.result = result;
        order.resolvedAt = now();
        order.resolvedVia = 'uscf-reprocess';
        this.autoFulfilled += 1;
        routed += 1;
        this.orders.unshift(order);
      } else {
        still.push(order);
      }
    }
    this.pendingOrders = still;
    this._persistDesk();
    return { ok: true, retried, routed, stillPending: still.length, uscf: { armedCount: snap.armedCount } };
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
    const snap = uscf.discovery();
    const hasCj = !!_cjKey() && uscf.cj.isConfigured();
    const mode = snap.autoShipReady
      ? (hasCj ? 'cj-dropship' : 'uscf-multi')
      : 'zeus-fulfillment-desk';
    return {
      ok: true,
      protocol: uscf.PROTOCOL,
      mode,
      cjConfigured: hasCj,
      printfulConfigured: uscf.printful.isConfigured(),
      printifyConfigured: uscf.printify.isConfigured(),
      webhookConfigured: !!FULFILL_WEBHOOK(),
      autoShipReady: snap.autoShipReady,
      armedCount: snap.armedCount,
      awaitingOwnerAuth: snap.awaitingOwnerAuth,
      uscf: snap,
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
      note: snap.note,
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
        cjDropshipping: uscf.cj.isConfigured(),
        printful: uscf.printful.isConfigured(),
        printify: uscf.printify.isConfigured(),
        webhook: !!FULFILL_WEBHOOK(),
        zeusFulfillmentDesk: true,
        adminEmail: ADMIN_EMAIL(),
      },
      mode: ready.mode,
      readiness: ready,
      uscf: ready.uscf,
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
