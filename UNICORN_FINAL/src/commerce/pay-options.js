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

function listUsd(productId) {
  try {
    const quote = require('../../backend/modules/priceNegotiator').getPriceSync(productId, {});
    const usd = Number(quote && quote.listUsd);
    if (usd > 0) return usd;
  } catch (_) { /* chip stays unlabeled */ }
  return 0;
}

function money(usd) {
  return '$' + Number(usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function payOptionsHtml(productId) {
  const id = String(productId || '').trim();
  if (!id) return '';
  const usd = listUsd(id);
  const links = payOptions(id).map((row) => {
    const label = (row.id !== 'btc' && usd > 0) ? (row.label + ' · ' + money(usd)) : row.label;
    return '<a class="btn" data-pay-rail="' + esc(row.id) + '" href="' + esc(row.href) + '">' + esc(label) + '</a>';
  }).join('');
  return '<span class="pay-options" data-pay-options="' + esc(id) + '" style="display:flex;flex-wrap:wrap;gap:8px">' + links + '</span>';
}

module.exports = {
  RAILS,
  checkoutHref,
  payOptions,
  payOptionsHtml,
};
