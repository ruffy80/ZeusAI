'use strict';

/**
 * Universal Payment Rails — forever choke-point for sellable CTAs.
 *
 * Every current/future sellable SKU (catalog, store, dropship, social tips)
 * must land on the method chooser: BTC · PayPal · NOWPayments.
 *
 * Virtual SKU prefixes resolve inside sovereign-commerce.createOrder:
 *   dropship:<productId>  — physical ZACC/dropship quote total
 *   social-tip:<handle>   — social support / tip amount
 *   tip:<userId>         — tip by user id
 */

const CHOOSER_LABEL = 'Buy → choose payment';
const RESERVE_LABEL = 'Reserve → choose payment';

const VIRTUAL_PREFIXES = ['dropship:', 'ds:', 'social-tip:', 'tip:'];

function isVirtualSku(serviceId) {
  const id = String(serviceId || '').trim().toLowerCase();
  return VIRTUAL_PREFIXES.some((p) => id.startsWith(p));
}

function parseVirtualSku(serviceId) {
  const raw = String(serviceId || '').trim();
  const lower = raw.toLowerCase();
  for (const p of VIRTUAL_PREFIXES) {
    if (lower.startsWith(p)) {
      return { prefix: p.replace(/:$/, ''), id: raw.slice(p.length).trim(), raw };
    }
  }
  return null;
}

function chooserHref(serviceId, opts) {
  const id = String(serviceId || '').trim();
  if (!id) return '/checkout/';
  let href = '/checkout/?plan=' + encodeURIComponent(id);
  const amount = opts && Number(opts.amountUsd);
  if (Number.isFinite(amount) && amount > 0) {
    href += '&amount=' + encodeURIComponent(String(amount));
  }
  if (opts && opts.preorder) href += '&preorder=1';
  if (opts && opts.email) href += '&email=' + encodeURIComponent(String(opts.email).trim());
  return href;
}

function ctaLabel(mode) {
  if (mode === 'reserve') return RESERVE_LABEL;
  if (mode === 'contact') return 'Request proposal →';
  return CHOOSER_LABEL;
}

/**
 * Build a primary buy CTA that always opens the multi-rail chooser.
 * Instant BTC mint is ONLY allowed on the checkout page itself (btc-direct).
 */
function primaryCtaHtml(serviceId, opts) {
  const o = opts || {};
  const id = String(serviceId || '').trim();
  if (!id) return '';
  const esc = typeof o.escape === 'function'
    ? o.escape
    : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const mode = String(o.mode || 'checkout').toLowerCase();
  if (mode === 'contact' || mode === 'unavailable') {
    const href = o.ctaHref || (mode === 'contact' ? '/enterprise#enterprise-contact' : '/services');
    const label = o.ctaLabel || (mode === 'contact' ? 'Request proposal →' : 'Unavailable');
    return `<a class="btn ${mode === 'contact' ? 'btn-gold' : 'btn-ghost'}" href="${esc(href)}" data-link style="${o.style || 'width:100%;justify-content:center'}">${esc(label)}</a>`;
  }
  const href = chooserHref(id, o);
  const label = o.ctaLabel || ctaLabel(mode);
  const style = o.style || 'flex:1;justify-content:center';
  const tag = o.tag || 'a';
  if (tag === 'button') {
    return `<button type="button" class="btn btn-primary" data-sovereign-buy="${esc(id)}" data-buy-mode="checkout" aria-label="${esc(label)}" style="${style}">${esc(label)}</button>`;
  }
  return `<a class="btn btn-primary" href="${esc(href)}" data-sovereign-buy="${esc(id)}" data-buy-mode="checkout" aria-label="${esc(label)}" style="${style}">${esc(label)}</a>`;
}

/**
 * Look up a dropship product for honesty gates (dispatchable / demoOnly).
 * Fail-open to null when ZACC is unavailable in this process.
 */
function lookupDropshipProduct(productId) {
  const id = String(productId || '').trim();
  if (!id) return null;
  try {
    const zacc = require('../../backend/modules/zacc');
    if (zacc && zacc.publisher && typeof zacc.publisher.get === 'function') {
      return zacc.publisher.get(id) || null;
    }
  } catch (_) { /* site-only / test contexts */ }
  return null;
}

/**
 * @param {string} serviceId
 * @param {object} [itemOrOpts] optional product fields (dispatchable, demoOnly) or { item }
 */
function assessVirtualBuyability(serviceId, itemOrOpts) {
  const v = parseVirtualSku(serviceId);
  if (!v || !v.id) {
    return { mode: 'unavailable', buyable: false, reason: 'invalid_virtual_sku', ctaLabel: 'Unavailable', ctaHref: null };
  }
  if (v.prefix === 'dropship' || v.prefix === 'ds') {
    const hint = (itemOrOpts && typeof itemOrOpts === 'object' && !itemOrOpts.item && (itemOrOpts.dispatchable != null || itemOrOpts.demoOnly != null || itemOrOpts.type || itemOrOpts.niche))
      ? itemOrOpts
      : ((itemOrOpts && itemOrOpts.item) || null);
    // Publisher lookup always wins over synthetic virtual-SKU stubs from resolveService.
    const looked = lookupDropshipProduct(v.id);
    const product = looked || hint;
    const allowDemo = String(process.env.ALLOW_DEMO_CHECKOUT || '') === '1';
    if (product) {
      if (product.demoOnly === true && !allowDemo) {
        return {
          mode: 'unavailable', buyable: false, reason: 'demo_not_for_sale',
          ctaLabel: 'Preview · not for sale', ctaHref: '/dropship',
        };
      }
      if (product.dispatchable === false && !allowDemo) {
        return {
          mode: 'unavailable', buyable: false, reason: 'not_dispatchable',
          ctaLabel: 'Preview · not for sale', ctaHref: '/dropship',
        };
      }
      // Explicit dispatchable:true on hint (tests) or looked product → buyable.
      // If neither source asserts dispatchable and we only have a weak hint, fail closed.
      if (product.dispatchable !== true && !looked && !allowDemo) {
        return {
          mode: 'unavailable', buyable: false, reason: 'not_dispatchable',
          ctaLabel: 'Preview · not for sale', ctaHref: '/dropship',
        };
      }
    } else if (!allowDemo) {
      // Fail-closed: unknown dropship id must not mint invoices via virtual SKU bypass.
      return {
        mode: 'unavailable', buyable: false, reason: 'dropship_product_not_found',
        ctaLabel: 'Unavailable', ctaHref: '/dropship',
      };
    }
    return {
      mode: 'checkout',
      buyable: true,
      reason: 'dropship_physical',
      ctaLabel: CHOOSER_LABEL,
      ctaHref: chooserHref(serviceId),
    };
  }
  if (v.prefix === 'social-tip' || v.prefix === 'tip') {
    return {
      mode: 'checkout',
      buyable: true,
      reason: 'social_tip',
      ctaLabel: 'Tip → choose payment',
      ctaHref: chooserHref(serviceId),
    };
  }
  return { mode: 'unavailable', buyable: false, reason: 'unknown_virtual', ctaLabel: 'Unavailable', ctaHref: null };
}

module.exports = {
  CHOOSER_LABEL,
  RESERVE_LABEL,
  VIRTUAL_PREFIXES,
  isVirtualSku,
  parseVirtualSku,
  chooserHref,
  ctaLabel,
  primaryCtaHtml,
  assessVirtualBuyability,
  lookupDropshipProduct,
};
