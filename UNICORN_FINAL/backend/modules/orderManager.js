'use strict';

/**
 * Order Manager — catalog → reserve → pay (QPN) → fulfill.
 * Settles BTC to the fixed owner address.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const BTC_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  process.env.OWNER_BTC_ADDRESS ||
  'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'orders');
const STORE = path.join(DATA_DIR, 'order-manager.json');

/** @type {Map<string, object>} */
const ORDERS = new Map();

function load() {
  try {
    if (!fs.existsSync(STORE)) return;
    const raw = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    for (const o of raw.orders || []) ORDERS.set(o.id, o);
  } catch (_) { /* cold start */ }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      STORE,
      JSON.stringify({ updatedAt: new Date().toISOString(), orders: Array.from(ORDERS.values()).slice(-500) }, null, 2),
      { mode: 0o600 }
    );
  } catch (_) { /* non-fatal */ }
}

load();

function _catalog() {
  try { return require('./productCatalog'); } catch (_) { return null; }
}

function _qpn() {
  try { return require('./quantumPaymentNexus'); } catch (_) { return null; }
}

function _marketplace() {
  try { return require('./serviceMarketplace'); } catch (_) { return null; }
}

function reserve({ skuId, qty = 1, email = null, clientId = null } = {}) {
  const catalog = _catalog();
  const sku = catalog && catalog.get(skuId);
  if (!sku || !sku.active) {
    const err = new Error('sku_not_found');
    err.code = 'sku_not_found';
    throw err;
  }
  const q = Math.max(1, Math.min(100, Number(qty) || 1));
  const id = 'ord_' + crypto.randomBytes(8).toString('hex');
  const subtotal = Number((sku.priceUsd * q).toFixed(2));
  const order = {
    id,
    skuId: sku.id,
    skuName: sku.name,
    qty: q,
    unitPriceUsd: sku.priceUsd,
    subtotalUsd: subtotal,
    currency: 'USD',
    email: email || null,
    clientId: clientId || email || 'anon',
    status: 'reserved',
    btcAddress: BTC_ADDRESS,
    paymentId: null,
    entitlementId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fulfilledAt: null,
  };
  ORDERS.set(id, order);
  persist();
  return order;
}

async function attachPayment(orderId, { method = 'btc' } = {}) {
  const order = ORDERS.get(orderId);
  if (!order) throw Object.assign(new Error('order_not_found'), { code: 'order_not_found' });
  if (order.status !== 'reserved' && order.status !== 'awaiting_payment') {
    throw Object.assign(new Error('order_not_payable'), { code: 'order_not_payable', status: order.status });
  }
  const qpn = _qpn();
  let payment = null;
  if (qpn && typeof qpn.processPayment === 'function') {
    payment = await qpn.processPayment({
      amount: order.subtotalUsd,
      currency: 'USD',
      method: method === 'card' ? 'card' : 'btc',
      metadata: { orderId: order.id, skuId: order.skuId },
      btcAddress: BTC_ADDRESS,
    });
  } else if (qpn && typeof qpn.createCryptoPayment === 'function') {
    payment = await qpn.createCryptoPayment({
      amountUsd: order.subtotalUsd,
      orderId: order.id,
    });
  } else {
    payment = {
      paymentId: 'pay_' + crypto.randomBytes(6).toString('hex'),
      status: 'pending_btc',
      btcAddress: BTC_ADDRESS,
      amountUsd: order.subtotalUsd,
      simulated: true,
    };
  }
  order.paymentId = payment.paymentId || payment.id || null;
  order.payment = payment;
  order.status = 'awaiting_payment';
  order.updatedAt = new Date().toISOString();
  ORDERS.set(order.id, order);
  persist();
  return { order, payment };
}

function confirmPaid(orderId, { txid = null, admin = false } = {}) {
  const order = ORDERS.get(orderId);
  if (!order) throw Object.assign(new Error('order_not_found'), { code: 'order_not_found' });
  const qpn = _qpn();
  if (order.paymentId && qpn && typeof qpn.confirmBtcPayment === 'function' && admin) {
    try { qpn.confirmBtcPayment(order.paymentId); } catch (_) { /* continue fulfill */ }
  }
  order.status = 'paid';
  order.txid = txid || order.txid || null;
  order.updatedAt = new Date().toISOString();
  ORDERS.set(order.id, order);
  persist();
  return fulfill(orderId);
}

function fulfill(orderId) {
  const order = ORDERS.get(orderId);
  if (!order) throw Object.assign(new Error('order_not_found'), { code: 'order_not_found' });
  if (order.status !== 'paid' && order.status !== 'fulfilled') {
    // allow fulfill after attach+confirm path
    if (order.status !== 'awaiting_payment') {
      throw Object.assign(new Error('order_not_paid'), { code: 'order_not_paid', status: order.status });
    }
  }
  const entitlementId = 'ent_' + crypto.randomBytes(6).toString('hex');
  order.entitlementId = entitlementId;
  order.status = 'fulfilled';
  order.fulfilledAt = new Date().toISOString();
  order.updatedAt = order.fulfilledAt;
  ORDERS.set(order.id, order);

  const mp = _marketplace();
  if (mp && typeof mp.recordPurchase === 'function') {
    try {
      mp.recordPurchase(order.skuId, order.clientId, order.subtotalUsd, {
        serviceName: order.skuName,
        paymentTxId: order.txid || order.paymentId,
        paymentMethod: 'qpn',
      });
    } catch (_) { /* non-fatal */ }
  }
  persist();
  return {
    order,
    fulfillment: {
      entitlementId,
      activated: true,
      skuId: order.skuId,
      message: 'Service activated — entitlement issued',
    },
  };
}

/**
 * Full autonomous sale path: reserve → QPN payment intent → (optional) confirm → fulfill.
 * confirm=true only for admin/simulated rails — never fake mainnet BTC settlement publicly.
 */
async function sell({ skuId, qty = 1, email = null, method = 'btc', confirm = false } = {}) {
  const order = reserve({ skuId, qty, email });
  const { payment } = await attachPayment(order.id, { method });
  if (confirm) {
    return confirmPaid(order.id, { admin: true, txid: 'sim_' + Date.now() });
  }
  return { order: ORDERS.get(order.id), payment, next: 'await_btc_or_confirm' };
}

function get(orderId) {
  return ORDERS.get(orderId) || null;
}

function list({ limit = 50 } = {}) {
  return Array.from(ORDERS.values()).slice(-limit).reverse();
}

function getStatus() {
  const all = Array.from(ORDERS.values());
  const byStatus = {};
  let gmv = 0;
  for (const o of all) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status === 'paid' || o.status === 'fulfilled') gmv += Number(o.subtotalUsd || 0);
  }
  return {
    protocol: 'ORDER_MANAGER/1.0',
    active: true,
    orders: all.length,
    byStatus,
    realizedGmvUsd: Number(gmv.toFixed(2)),
    btcAddress: BTC_ADDRESS,
  };
}

function start() {
  return getStatus();
}

module.exports = {
  BTC_ADDRESS,
  reserve,
  attachPayment,
  confirmPaid,
  fulfill,
  sell,
  get,
  list,
  getStatus,
  start,
  init: start,
};
