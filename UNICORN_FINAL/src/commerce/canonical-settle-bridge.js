'use strict';

/**
 * Canonical Settle Bridge — CSB/1.0
 *
 * Innovation: one attribution plane across sovereign ORDERS (site) and
 * customer-portal SQLite (backend recovery). Sovereign remains money SoT;
 * portal receives a dual-write shadow order so abandoned-cart recovery and
 * portal dashboards see the same invoice without inventing a second settle.
 *
 * Honesty: bridge failures never block invoice mint or paid settle.
 */

function bridgeCreate(order) {
  if (!order || !order.orderId) return { ok: false, reason: 'no_order' };
  try {
    const portal = require('./customer-portal');
    let customerId = null;
    const email = String((order.buyer && order.buyer.email) || '').trim().toLowerCase();
    if (email && email.includes('@')) {
      try {
        const c = portal.upsertFromBackend({ email, name: email.split('@')[0] });
        customerId = c && c.id;
      } catch (_) { /* guest invoice OK without portal customer */ }
    }
    const portalOrder = portal.createOrder({
      customerId,
      productId: order.serviceId,
      priceUSD: Number(order.subtotal_fiat || 0),
      btcAmount: Number(order.amount_btc || 0),
      btcAddress: order.receive_address || null,
      invoiceUri: order.bip21 || order.checkout_url || null,
      status: 'awaiting_payment',
      inputs: {
        sovereignOrderId: order.orderId,
        access_token: order.access_token,
        checkout_url: order.checkout_url,
        affiliateRef: (order.affiliate && order.affiliate.ref) || (order.meta && order.meta.affiliateRef) || undefined,
        settleBridge: 'CSB/1.0',
      },
    });
    return {
      ok: true,
      protocol: 'CSB/1.0',
      portalOrderId: portalOrder.id,
      customerId: customerId || null,
      sovereignOrderId: order.orderId,
    };
  } catch (e) {
    return { ok: false, reason: 'bridge_create_failed', error: String(e && e.message || e).slice(0, 160) };
  }
}

function bridgePaid(order) {
  if (!order || !order.orderId) return { ok: false, reason: 'no_order' };
  const portalOrderId = order.meta && order.meta.portalOrderId;
  if (!portalOrderId) return { ok: false, reason: 'no_portal_order' };
  try {
    const portal = require('./customer-portal');
    portal.updateOrder(portalOrderId, {
      status: 'paid',
      paidAt: order.paid_at || new Date().toISOString(),
      btcAmount: Number(order.amount_btc || 0),
      summary: {
        sovereignOrderId: order.orderId,
        txids: order.txids || [],
        confirmations: order.confirmations || 0,
        settleBridge: 'CSB/1.0',
      },
    });
    return { ok: true, protocol: 'CSB/1.0', portalOrderId, sovereignOrderId: order.orderId };
  } catch (e) {
    return { ok: false, reason: 'bridge_paid_failed', error: String(e && e.message || e).slice(0, 160) };
  }
}

function getStatus() {
  return {
    ok: true,
    name: 'canonical-settle-bridge',
    protocol: 'CSB/1.0',
    honesty: 'Sovereign ORDERS remain money SoT; portal dual-write is recovery/dashboard shadow only.',
  };
}

module.exports = { bridgeCreate, bridgePaid, getStatus, PROTOCOL: 'CSB/1.0' };
