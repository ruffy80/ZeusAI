'use strict';

/**
 * Bridge sovereign BTC settle → World-Standard Inventions (PoOP / CTP / DPS / VOM).
 * Additive, best-effort, never throws into the payment path.
 *
 * Prefer HTTP to BACKEND so in-memory WSI on the API process stays hot;
 * always also call the local module so shared data/world-standard/* is written
 * even when the backend is down (site-only / degraded mode).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function _backendBase() {
  return String(process.env.BACKEND_API_URL || process.env.BACKEND_ORIGIN || '')
    .replace(/\/$/, '');
}

function _postJson(urlStr, body) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const lib = u.protocol === 'https:' ? https : http;
      const raw = JSON.stringify(body || {});
      const req = lib.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(raw),
          Accept: 'application/json',
        },
        timeout: 4000,
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 }));
      });
      req.on('error', () => resolve({ ok: false }));
      req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve({ ok: false }); });
      req.write(raw);
      req.end();
    } catch (_) {
      resolve({ ok: false });
    }
  });
}

function _localWsi() {
  try {
    return require('../../backend/modules/world-standard-inventions');
  } catch (_) {
    try {
      return require('../../backend/modules/world-standard');
    } catch (__) {
      return null;
    }
  }
}

function payloadFromOrder(order, extra) {
  const email = (order && order.buyer && order.buyer.email)
    || (order && order.email)
    || (order && order.customerEmail)
    || '';
  return {
    orderId: order && (order.orderId || order.id),
    serviceId: order && order.serviceId,
    email,
    amountUsd: order && (order.subtotal_fiat != null ? order.subtotal_fiat : order.amountUsd),
    amountBtc: order && order.amount_btc,
    txid: order && ((order.txids && order.txids[0]) || order.txid),
    status: 'paid',
    paid: true,
    buyMode: order && (order.buy_mode || (order.meta && order.meta.buyMode)),
    source: 'sovereign-commerce',
    ...(extra || {}),
  };
}

function onPaymentConfirmed(order, extra) {
  const payload = payloadFromOrder(order, extra);
  if (!payload.orderId) return { ok: false, reason: 'missing_order' };

  try {
    const wsi = _localWsi();
    if (wsi && typeof wsi.onPaymentConfirmed === 'function') {
      wsi.onPaymentConfirmed(payload);
    }
    // Open VOM cycle when serviceId matches a real vertical machine
    if (wsi && wsi.vom && typeof wsi.vom.openCycle === 'function'
      && typeof wsi.vom.listVerticals === 'function') {
      try {
        const vert = (wsi.vom.listVerticals() || []).find((v) => v.serviceId === payload.serviceId);
        if (vert) {
          wsi.vom.openCycle({
            verticalId: vert.id,
            orderId: payload.orderId,
            serviceId: payload.serviceId,
            email: payload.email,
            amountUsd: payload.amountUsd,
            paid: true,
          });
        }
      } catch (_) { /* best-effort */ }
    }
  } catch (e) {
    console.warn('[wsi-bridge] local onPaymentConfirmed:', e && e.message);
  }

  const base = _backendBase();
  if (base) {
    Promise.resolve(_postJson(base + '/api/poop/open', payload)).catch(() => {});
    Promise.resolve(_postJson(base + '/api/ctp/issue', payload)).catch(() => {});
    const verticalGuess = String(payload.serviceId || '') === 'instant-website-audit'
      ? 'local-services'
      : (String(payload.serviceId || '') === 'instant-pitch-deck'
        ? 'saas-onboarding'
        : (String(payload.serviceId || '') === 'instant-seo-content-pack' ? 'seo-agency' : null));
    if (verticalGuess) {
      Promise.resolve(_postJson(base + '/api/vom/open', {
        verticalId: verticalGuess,
        orderId: payload.orderId,
        serviceId: payload.serviceId,
        email: payload.email,
        amountUsd: payload.amountUsd,
        paid: true,
      })).catch(() => {});
    }
  }
  return { ok: true, orderId: payload.orderId };
}

function onDeliveryCompleted(order, delivery, extra) {
  const payload = payloadFromOrder(order, {
    artifact: delivery || { orderId: order && (order.orderId || order.id), closedAt: new Date().toISOString() },
    artifactHash: (extra && extra.artifactHash)
      || (delivery && delivery.id)
      || null,
    ...(extra || {}),
  });
  if (!payload.orderId) return { ok: false, reason: 'missing_order' };

  try {
    const wsi = _localWsi();
    if (wsi && typeof wsi.onDeliveryCompleted === 'function') {
      wsi.onDeliveryCompleted(payload);
    }
    if (wsi && wsi.vom && typeof wsi.vom.advanceDelivery === 'function'
      && typeof wsi.vom.listVerticals === 'function') {
      try {
        const vert = (wsi.vom.listVerticals() || []).find((v) => v.serviceId === payload.serviceId);
        if (vert) {
          wsi.vom.advanceDelivery({ orderId: payload.orderId, artifactHash: payload.artifactHash });
        }
      } catch (_) { /* best-effort */ }
    }
  } catch (e) {
    console.warn('[wsi-bridge] local onDeliveryCompleted:', e && e.message);
  }

  const base = _backendBase();
  if (base) {
    Promise.resolve(_postJson(base + '/api/dps/issue', payload)).catch(() => {});
    const isVomSku = ['instant-seo-content-pack', 'instant-website-audit', 'instant-pitch-deck']
      .includes(String(payload.serviceId || ''));
    if (isVomSku) {
      Promise.resolve(_postJson(base + '/api/vom/deliver', {
        orderId: payload.orderId,
        artifactHash: payload.artifactHash,
      })).catch(() => {});
    }
  }
  return { ok: true, orderId: payload.orderId };
}

module.exports = {
  onPaymentConfirmed,
  onDeliveryCompleted,
  payloadFromOrder,
};
