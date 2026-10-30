'use strict';

/**
 * Every current and future sellable product uses these four checkout rails.
 * New product cards call payOptionsHtml(id). Do not add a Bitcoin-only buy link.
 * Card opens the hosted card checkout (Stripe when that key exists, otherwise
 * the NOWPayments invoice, which accepts cards). NOWPayments stays its own rail.
 */

const RAILS = Object.freeze([
  { id: 'btc', label: 'Bitcoin' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'card', label: 'Card' },
  { id: 'nowpayments', label: 'NOWPayments' },
]);

function checkoutHref(productId, rail) {
  const id = encodeURIComponent(String(productId || '').trim());
  const method = RAILS.some((row) => row.id === rail) ? rail : 'btc';
  return '/checkout/?plan=' + id + '&rail=' + encodeURIComponent(method);
}

function payOptions(productId) {
  return RAILS.map((rail) => ({
    id: rail.id,
    label: rail.label,
    href: checkoutHref(productId, rail.id),
  }));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function payOptionsHtml(productId) {
  const id = String(productId || '').trim();
  if (!id) return '';
  const links = payOptions(id).map((row) => (
    '<a class="btn" data-pay-rail="' + esc(row.id) + '" href="' + esc(row.href) + '">' + esc(row.label) + '</a>'
  )).join('');
  return '<span class="pay-options" data-pay-options="' + esc(id) + '" style="display:flex;flex-wrap:wrap;gap:8px">' + links + '</span>';
}

module.exports = {
  RAILS,
  checkoutHref,
  payOptions,
  payOptionsHtml,
};
