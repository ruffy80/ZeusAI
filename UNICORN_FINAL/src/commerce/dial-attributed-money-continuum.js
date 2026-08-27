'use strict';

/**
 * DAMC/1.0 — Dial-Attributed Money Continuum
 *
 * Closes the MobDial → checkout → paid loop that previously attributed only
 * at create-time (paid:false) and never stamped the dial onto the order or
 * re-attributed on settle. Also mints dialed checkout URLs for Telegram money
 * CTAs so swarm attribution survives the buy click.
 *
 * Never invents GMV. Fail-soft everywhere.
 */

const PROTOCOL = 'DAMC/1.0';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

function extractDial(input) {
  if (input == null) return '';
  if (typeof input === 'string') {
    const s = input.trim().toUpperCase();
    return s.startsWith('UDIAL-') ? s : '';
  }
  if (typeof input !== 'object') return '';
  const raw = String(
    input.dial
    || input.ref
    || input.utm_content
    || (input.mobdial && input.mobdial.code)
    || (input.meta && input.meta.dial)
    || ''
  ).trim().toUpperCase();
  return raw.startsWith('UDIAL-') ? raw : '';
}

function stampOrder(order, dialOrInput) {
  if (!order || typeof order !== 'object') return { ok: false, reason: 'no_order' };
  const dial = extractDial(dialOrInput) || extractDial(order);
  if (!dial) return { ok: false, reason: 'no_dial' };
  order.meta = Object.assign({}, order.meta || {}, {
    dial,
    damc: PROTOCOL,
  });
  order.mobdial = Object.assign({}, order.mobdial || {}, {
    code: dial,
    attributed: true,
    protocol: 'MDB/1.0',
    continuum: PROTOCOL,
  });
  return { ok: true, dial, order };
}

function _mobdial() {
  try { return require('../../backend/modules/telegram-mobdial-os'); } catch (_) {
    try { return require('../backend/modules/telegram-mobdial-os'); } catch (e2) { return null; }
  }
}

/**
 * Attribute a pending checkout (create path). Persist dial on order.
 */
function attributeCreate(order, dialOrInput) {
  const stamped = stampOrder(order, dialOrInput);
  if (!stamped.ok) return stamped;
  const md = _mobdial();
  let attr = null;
  if (md && typeof md.attributeCheckout === 'function') {
    try {
      attr = md.attributeCheckout({
        dial: stamped.dial,
        orderId: order.orderId || order.id,
        serviceId: order.serviceId,
        paid: false,
        status: order.status || 'pending',
      });
    } catch (_) { /* ignore */ }
  }
  return { ok: true, dial: stamped.dial, attr, protocol: PROTOCOL };
}

/**
 * Re-attribute on paid settle + optional causal echo.
 */
function attributePaid(order) {
  const dial = extractDial(order) || extractDial(order && order.meta) || extractDial(order && order.mobdial);
  if (!dial) return { ok: false, reason: 'no_dial' };
  const md = _mobdial();
  let attr = null;
  if (md && typeof md.attributeCheckout === 'function') {
    try {
      attr = md.attributeCheckout({
        dial,
        orderId: order.orderId || order.id,
        serviceId: order.serviceId,
        paid: true,
        status: 'paid',
        templateId: 'damc_paid',
      });
    } catch (e) {
      return { ok: false, reason: 'attr_error', error: String(e && e.message || e).slice(0, 80) };
    }
  }
  let echo = null;
  try {
    if (md && typeof md.postCausalEcho === 'function' && process.env.DAMC_SKIP_ECHO !== '1') {
      // Fire-and-forget — settle must not await Telegram
      Promise.resolve(md.postCausalEcho(false)).then((r) => { echo = r; }).catch(() => {});
      echo = { queued: true };
    }
  } catch (_) { /* ignore */ }
  return { ok: true, dial, attr, echo, protocol: PROTOCOL, invention: 'PDCE' };
}

/**
 * Build a checkout URL that carries the dial for swarm attribution.
 */
function dialCheckoutHref(serviceId, dialCode, opts) {
  const o = opts || {};
  const base = (o.appUrl || APP_URL).replace(/\/+$/, '');
  const plan = encodeURIComponent(String(serviceId || '').trim());
  const u = new URL(base + '/checkout/');
  if (plan) u.searchParams.set('plan', String(serviceId).trim());
  const dial = extractDial(dialCode) || String(dialCode || '').trim().toUpperCase();
  if (dial.startsWith('UDIAL-')) {
    u.searchParams.set('dial', dial);
    u.searchParams.set('ref', dial);
    u.searchParams.set('utm_source', 'telegram');
    u.searchParams.set('utm_medium', 'mobdial');
    u.searchParams.set('utm_content', dial);
  }
  return u.toString();
}

/**
 * Issue (or reuse) a swarm dial for money CTAs. Returns code or ''.
 */
function ensureMoneyDial(fromHint) {
  const md = _mobdial();
  if (!md || typeof md.issueDial !== 'function') return '';
  try {
    const issued = md.issueDial(fromHint || { id: 'money_surface', username: 'amos_damc' });
    const code = issued && issued.member && issued.member.code;
    return code && String(code).startsWith('UDIAL-') ? String(code) : '';
  } catch (_) {
    return '';
  }
}

function decorateSkuWithDial(sku, dialCode) {
  if (!sku || typeof sku !== 'object') return sku;
  const dial = extractDial(dialCode) || String(dialCode || '').trim().toUpperCase();
  if (!dial.startsWith('UDIAL-')) return sku;
  const href = dialCheckoutHref(sku.id, dial);
  return Object.assign({}, sku, {
    dial,
    checkoutHref: href,
    dialCheckoutHref: href,
    damc: PROTOCOL,
  });
}

function status() {
  return {
    ok: true,
    protocol: PROTOCOL,
    inventions: {
      DAMC: 'Dial-Attributed Money Continuum — persist dial + paid re-attribute',
      PDCE: 'Paid Dial Causal Echo — settle triggers MobDial echo when dial present',
    },
    honesty: 'Only attributes real UDIAL-* codes. Never invents GMV or dials.',
  };
}

module.exports = {
  PROTOCOL,
  extractDial,
  stampOrder,
  attributeCreate,
  attributePaid,
  dialCheckoutHref,
  ensureMoneyDial,
  decorateSkuWithDial,
  status,
};
