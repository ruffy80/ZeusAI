'use strict';

/**
 * Perfection Continuum OS (PCOS/1.0)
 *
 * Highest-leverage honesty layer on top of PIOS / universal rails:
 *  - Account pending resume payload (BTC + PayPal + NOW)
 *  - Delivery / receipt method honesty (no forced "BTC" after alt-rail pay)
 *  - Printable HTML receipt rail block
 *  - Human via labels for passport / invoice / ops surfaces
 *
 * Never invents PayPal/NOW links. Never invents GMV.
 */

const PROTOCOL = 'PCOS/1.0';

function normalizeVia(via) {
  const v = String(via || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'btc' || v === 'bitcoin' || v === 'onchain') return 'btc';
  if (v === 'paypal' || v === 'pp') return 'paypal';
  if (v === 'nowpayments' || v === 'now' || v === 'card' || v === 'crypto') return 'nowpayments';
  return v;
}

function viaLabel(via) {
  const v = normalizeVia(via);
  if (v === 'btc') return 'Bitcoin';
  if (v === 'paypal') return 'PayPal';
  if (v === 'nowpayments') return 'Card / crypto (NOWPayments)';
  return v ? String(via) : 'payment';
}

function methodCode(via) {
  const v = normalizeVia(via);
  if (v === 'paypal') return 'PAYPAL';
  if (v === 'nowpayments') return 'NOWPAYMENTS';
  if (v === 'btc') return 'BTC';
  return v ? String(via).toUpperCase() : 'BTC';
}

function providerRefFromOrder(order) {
  if (!order) return null;
  const meta = order.meta || {};
  const settle = order.provider_settle || {};
  if (settle.providerRef) return settle.providerRef;
  if (Array.isArray(order.provider_refs) && order.provider_refs.length) {
    const first = order.provider_refs[0];
    if (typeof first === 'string') return first;
    if (first && (first.ref || first.id)) return first.ref || first.id;
  }
  return (
    meta.paypalCaptureId ||
    meta.paypalOrderId ||
    meta.nowpaymentsInvoiceId ||
    meta.nowpaymentsPaymentId ||
    null
  );
}

/**
 * Account /customer/me pending row for a sovereign order.
 * Surfacing all armed resume links so buyers are never stranded on BTC-only UI.
 */
function accountPendingFromOrder(order) {
  if (!order) return null;
  const oid = order.orderId || order.id;
  if (!oid) return null;
  const meta = order.meta || {};
  const selected = normalizeVia(meta.selectedRail) || 'btc';
  const paypalHref = meta.paypalApproveHref || null;
  const nowUrl = meta.nowpaymentsInvoiceUrl || null;
  const method = methodCode(
    paypalHref && selected === 'paypal'
      ? 'paypal'
      : nowUrl && selected === 'nowpayments'
        ? 'nowpayments'
        : selected === 'btc' || (!paypalHref && !nowUrl)
          ? 'btc'
          : selected
  );
  return {
    receiptId: oid,
    plan: order.serviceId || order.plan,
    amount: order.subtotal_fiat != null ? order.subtotal_fiat : order.amount_usd,
    method,
    selectedRail: selected,
    btcAmount: order.amount_btc,
    btcAddress: order.receive_address || order.address || null,
    btcUri: order.bip21 || null,
    bip21: order.bip21 || null,
    approveHref: paypalHref,
    paypalApproveHref: paypalHref,
    nowpaymentsInvoiceUrl: nowUrl,
    nowInvoiceUrl: nowUrl,
    createdAt: order.created_at,
    statusUrl: `/api/order/${encodeURIComponent(oid)}/status`,
    invoiceUrl: `/checkout/${encodeURIComponent(oid)}`,
    checkoutUrl: order.checkout_url || `/checkout/${encodeURIComponent(oid)}`,
    rail: 'sovereign',
    multiRail: !!(paypalHref || nowUrl),
  };
}

/**
 * Patch for delivery hook receipt-like object so emails/fulfillment see real rail.
 */
function deliveryReceiptPatch(order) {
  const via = normalizeVia(order && order.paid_via) || 'btc';
  const ref = providerRefFromOrder(order);
  const txid = (order && order.txids && order.txids[0]) || null;
  return {
    method: methodCode(via),
    paid_via: via,
    paidVia: via,
    providerRef: ref,
    txid: via === 'btc' ? txid : (txid || null),
  };
}

/**
 * Fields for order_receipt email (compatible with transactional-email template).
 */
function receiptEmailPatch(receipt) {
  const via = normalizeVia(receipt && (receipt.paid_via || receipt.paidVia || receipt.method));
  const providerRef = (receipt && (receipt.providerRef || receipt.provider_ref)) || null;
  return {
    paid_via: via || (receipt && receipt.txid ? 'btc' : null),
    providerRef: providerRef,
  };
}

/**
 * HTML fragments for printable /checkout/:id/receipt (escaped externally).
 */
function htmlReceiptFields(order, escapeHtml) {
  const esc = typeof escapeHtml === 'function'
    ? escapeHtml
    : (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const via = normalizeVia(order && order.paid_via) || 'btc';
  const label = viaLabel(via);
  const ref = providerRefFromOrder(order);
  const txids = (order && order.txids) || [];
  const amountBtc = order && order.amount_btc != null ? String(order.amount_btc) : '';
  const fiat = order && order.subtotal_fiat != null ? String(order.subtotal_fiat) : '';
  const currency = (order && order.currency) || 'USD';
  const amountDd = via === 'btc'
    ? `${esc(amountBtc)} BTC ≈ ${esc(fiat)} ${esc(currency)}`
    : `${esc(fiat)} ${esc(currency)}${amountBtc ? ` <span style="color:#666">(catalog BTC equiv. ${esc(amountBtc)})</span>` : ''}`;
  const proofDd = via === 'btc'
    ? (txids.map((t) => `<code>${esc(t)}</code>`).join('<br>') || '—')
    : (ref
      ? `<code>${esc(String(ref))}</code> <span style="color:#666">(${esc(label)})</span>`
      : (txids.map((t) => `<code>${esc(t)}</code>`).join('<br>') || '—'));
  return {
    via,
    viaLabel: label,
    amountDd,
    paidViaDt: '<dt>Paid via</dt>',
    paidViaDd: `<dd>${esc(label)}</dd>`,
    proofDt: via === 'btc' ? '<dt>TXIDs</dt>' : '<dt>Settlement ref</dt>',
    proofDd: `<dd>${proofDd}</dd>`,
  };
}

/**
 * Wallet / VC credentialSubject honesty for alt-rail pays.
 */
function walletSubjectPatch(order) {
  const via = normalizeVia(order && order.paid_via) || 'btc';
  const ref = providerRefFromOrder(order);
  const txid = (order && order.txids && order.txids[0]) || null;
  return {
    paidVia: via,
    paidViaLabel: viaLabel(via),
    bitcoinTxId: via === 'btc' ? txid : null,
    providerRef: via === 'btc' ? null : ref,
    receiveAddress: via === 'btc' ? (order && order.receive_address) || null : null,
  };
}

module.exports = {
  PROTOCOL,
  normalizeVia,
  viaLabel,
  methodCode,
  providerRefFromOrder,
  accountPendingFromOrder,
  deliveryReceiptPatch,
  receiptEmailPatch,
  htmlReceiptFields,
  walletSubjectPatch,
};
