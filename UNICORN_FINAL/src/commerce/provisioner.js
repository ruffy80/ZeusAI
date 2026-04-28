// commerce/provisioner.js
// Marks an order paid (via webhook or admin) and triggers activation hooks.
// Lazy-requires portal + notifier so import order is irrelevant.
//
// handleWebhookSettle({orderId, txRef}) → updated order
// markPaidManual(orderId, note?)        → updated order

const path = require('path');
const fs = require('fs');

function lazyPortal() {
  try { return require('./customer-portal'); } catch (_) { return null; }
}
function lazyNotifier() {
  try { return require('./notifier'); } catch (_) { return null; }
}
function lazyProductEngine() {
  try { return require('./product-engine'); } catch (_) { return null; }
}

function nowIso() { return new Date().toISOString(); }

function settleOrder(order, txRef, source) {
  const ts = nowIso();
  if (order.status !== 'paid' && order.status !== 'delivered') {
    order.status = 'paid';
    order.paidAt = ts;
    order.txRef = txRef || order.txRef || null;
    order.paymentSource = source || order.paymentSource || null;
  }
  return order;
}

function autoDeliver(order) {
  // Best-effort: produce a default receipt-style deliverable so downloads have at least one artifact.
  const eng = lazyProductEngine();
  if (!eng) return;
  try {
    const existing = eng.listDeliverables(order.id);
    if (existing.length > 0) {
      order.deliverables = existing.map(name => ({
        name,
        url: '/api/customer/deliverable/' + order.id + '/' + encodeURIComponent(name)
      }));
      return;
    }
    const summary = {
      orderId: order.id,
      productId: order.productId,
      paidAt: order.paidAt,
      txRef: order.txRef || null,
      priceUSD: order.priceUSD,
      btcAmount: order.btcAmount || null,
      issuedAt: nowIso()
    };
    eng.writeDeliverable(order.id, 'receipt.json', JSON.stringify(summary, null, 2));
    order.deliverables = [{ name: 'receipt.json', url: '/api/customer/deliverable/' + order.id + '/receipt.json' }];
    order.summary = 'Auto-issued receipt. Product: ' + order.productId + '. TX: ' + (order.txRef || '—');
  } catch (e) {
    // Don't fail webhook on delivery errors.
    console.warn('[provisioner] autoDeliver failed:', e.message);
  }
}

async function handleWebhookSettle(opts) {
  const orderId = String((opts && opts.orderId) || '');
  const txRef = String((opts && opts.txRef) || '').slice(0, 200);
  if (!orderId) throw new Error('orderId_required');
  const portal = lazyPortal();
  if (!portal) throw new Error('portal_offline');
  const order = portal.getOrder(orderId);
  if (!order) throw new Error('order_not_found');
  settleOrder(order, txRef, 'webhook');
  autoDeliver(order);
  if (order.deliverables && order.deliverables.length && order.status !== 'delivered') {
    order.status = 'delivered';
    order.deliveredAt = nowIso();
  }
  portal.updateOrder(order.id, order);
  // Best-effort activation hook into the host app (chained via global.__USE_ON_RECEIPT__).
  try {
    const hook = global.__USE_ON_RECEIPT__;
    if (typeof hook === 'function') {
      // Resolve customer email via the portal (orders only carry customerId).
      let custEmail = '';
      try {
        if (order.customerId) {
          const c = portal.getById(order.customerId);
          if (c && c.email) custEmail = c.email;
        }
      } catch (_) {}
      hook({ id: order.id, status: order.status, plan: order.productId, services: [order.productId], customerId: order.customerId, email: custEmail, amount: order.priceUSD, currency: 'USD', method: 'WEBHOOK', txid: order.txRef });
    }
  } catch (_) {}
  // Best-effort owner notification.
  try {
    const n = lazyNotifier();
    if (n) n.notifyOwner({ subject: '[UNICORN] Order settled — ' + order.id, body: 'Order: ' + order.id + '\nProduct: ' + order.productId + '\nTX: ' + (order.txRef || '—') + '\nUSD: ' + order.priceUSD, priority: 'low' }).catch(()=>{});
  } catch (_) {}
  return order;
}

async function markPaidManual(orderId, note) {
  const portal = lazyPortal();
  if (!portal) throw new Error('portal_offline');
  const order = portal.getOrder(String(orderId||''));
  if (!order) throw new Error('order_not_found');
  settleOrder(order, 'manual:' + (note || 'admin'), 'admin');
  autoDeliver(order);
  if (order.deliverables && order.deliverables.length && order.status !== 'delivered') {
    order.status = 'delivered';
    order.deliveredAt = nowIso();
  }
  portal.updateOrder(order.id, order);
  return order;
}

module.exports = { handleWebhookSettle, markPaidManual };
