'use strict';

/**
 * Invoice attribution.
 * The rail the buyer clicked and the provider that actually settled stay separate.
 * A card click opens NOWPayments until a Stripe session exists. A Stripe session
 * is Stripe. A Bitcoin fallback is Bitcoin, even when NOWPayments was requested.
 * Public views omit the customer email.
 */

function requestedRail(order, body) {
  const raw = String(
    (body && (body.rail || body.selectedRail))
    || (order && order.meta && (order.meta.selectedRail || order.meta.rail))
    || ''
  ).trim().toLowerCase();
  if (raw === 'card') return 'card';
  if (raw === 'stripe') return 'stripe';
  if (raw === 'paypal' || raw === 'pp') return 'paypal';
  if (raw === 'nowpayments' || raw === 'now' || raw === 'crypto') return 'nowpayments';
  if (raw === 'btc' || raw === 'bitcoin') return 'btc';
  return null;
}

function settlementProvider(requested, actual) {
  const act = String(actual || '').trim().toLowerCase();
  if (act === 'stripe') return 'stripe';
  if (act === 'paypal' || act === 'pp') return 'paypal';
  if (act === 'nowpayments' || act === 'now') return 'nowpayments';
  if (act === 'btc' || act === 'bitcoin') return 'btc';
  if (requested === 'card' || requested === 'nowpayments') return 'nowpayments';
  if (requested === 'stripe') return 'stripe';
  if (requested === 'paypal') return 'paypal';
  if (requested === 'btc') return 'btc';
  return act || null;
}

function railFromInvoice(invoice) {
  const meta = (invoice && invoice.metadata) || {};
  const raw = String(
    (invoice && (invoice.provider || invoice.paid_via || invoice.rail))
    || meta.provider
    || meta.settlementProvider
    || ''
  ).trim().toLowerCase();
  if (raw === 'stripe') return 'stripe';
  if (raw === 'paypal' || raw === 'pp') return 'paypal';
  if (raw === 'nowpayments' || raw === 'now') return 'nowpayments';
  if (raw === 'card') return 'nowpayments';
  return 'btc';
}

function stampOpen(order, opts) {
  if (!order) return null;
  const input = opts || {};
  const requested = input.requestedRail || requestedRail(order, input) || 'btc';
  const provider = settlementProvider(requested, input.provider);
  order.meta = Object.assign({}, order.meta || {}, {
    selectedRail: requested,
    settlementProvider: provider,
  });
  order.invoice = {
    provider,
    requestedRail: requested,
    transactionId: input.transactionId ? String(input.transactionId).slice(0, 128) : null,
    customer: (order.buyer && order.buyer.email) || null,
    product: order.serviceId || null,
    amount: order.subtotal_fiat != null ? Number(order.subtotal_fiat) : null,
    currency: order.currency || 'USD',
    paymentStatus: input.paymentStatus || 'waiting',
    invoiceStatus: 'open',
  };
  return order.invoice;
}

function stampPaid(order, proof) {
  if (!order) return null;
  const prev = order.invoice || {};
  const requested = prev.requestedRail || requestedRail(order) || null;
  const provider = settlementProvider(requested, proof && proof.provider);
  const transactionId = String((proof && (proof.providerRef || proof.transactionId)) || prev.transactionId || '').slice(0, 128) || null;
  order.invoice = {
    provider,
    requestedRail: requested,
    transactionId,
    customer: prev.customer || (order.buyer && order.buyer.email) || null,
    product: order.serviceId || prev.product || null,
    amount: order.subtotal_fiat != null ? Number(order.subtotal_fiat) : (prev.amount != null ? prev.amount : null),
    currency: order.currency || prev.currency || 'USD',
    paymentStatus: 'paid',
    invoiceStatus: 'paid',
  };
  if (provider) order.paid_via = provider;
  return order.invoice;
}

function publicView(order) {
  const inv = order && order.invoice;
  if (!inv) return null;
  return {
    provider: inv.provider || null,
    requestedRail: inv.requestedRail || null,
    transactionId: inv.transactionId || null,
    product: inv.product || order.serviceId || null,
    amount: inv.amount != null ? inv.amount : (order.subtotal_fiat != null ? Number(order.subtotal_fiat) : null),
    currency: inv.currency || order.currency || 'USD',
    paymentStatus: inv.paymentStatus || null,
    invoiceStatus: inv.invoiceStatus || null,
  };
}

module.exports = {
  requestedRail,
  settlementProvider,
  railFromInvoice,
  stampOpen,
  stampPaid,
  publicView,
};
