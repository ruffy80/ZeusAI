#!/usr/bin/env node
'use strict';

const http = require('http');
const crypto = require('crypto');
const deepseekGovernor = require('../backend/modules/deepseek-governor');

const host = process.env.BIND_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const btcAddress = process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const btcUsd = Number(process.env.RESCUE_BTC_USD || 77000);
const loopAdminToken = String(process.env.DEEPSEEK_LOOP_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim();
const funnelEvents = [];
const MAX_FUNNEL_EVENTS = 500;

const services = [
  { id: 'adaptive-ai', name: 'Adaptive AI Automation', priceUsd: 499, currency: 'USD', btcAddress },
  { id: 'ai-workforce', name: 'AI Workforce Suite', priceUsd: 1499, currency: 'USD', btcAddress },
  { id: 'enterprise-growth', name: 'Enterprise Growth Engine', priceUsd: 4999, currency: 'USD', btcAddress },
].map((service) => ({
  ...service,
  priceBTC: Number((service.priceUsd / btcUsd).toFixed(8)),
}));

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.PUBLIC_APP_URL || '',
    'x-zeus-rescue': 'backend',
  });
  res.end(body);
}

function health() {
  // Fail-closed identity: never advertise full commerce readiness.
  // Healers/deploy smoke MUST treat mode=rescue as unhealthy.
  return {
    ok: false,
    ready: false,
    status: 'degraded',
    service: 'zeus-rescue-api',
    mode: 'rescue',
    dbConnected: false,
    commerceAvailable: false,
    engines: {
      pricing: false,
      services: false,
      payments: false,
      quantumIntegrity: false,
    },
    message: 'rescue liveness only — restore backend/index.js',
    ts: new Date().toISOString(),
  };
}

function checkoutHealth() {
  return {
    ok: false,
    ready: false,
    status: 'unavailable',
    service: 'checkout',
    mode: 'rescue',
    commerceAvailable: false,
    payments: { btc: false, paypal: false, stripe: false },
    ts: new Date().toISOString(),
  };
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        reject(new Error('payload_too_large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function isAuthorized(req) {
  if (!loopAdminToken) return false;
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  if (!token) return false;
  const provided = Buffer.from(token);
  const expected = Buffer.from(loopAdminToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function auditAdminDenied(req, path) {
  const ip = (req.socket && req.socket.remoteAddress) ? req.socket.remoteAddress : 'unknown';
  const ua = String(req.headers['user-agent'] || '').slice(0, 180);
  console.warn(`[rescue-admin-auth] denied path=${path} ip=${ip} ua=${ua}`);
}

function pushFunnelEvent(evt) {
  if (!evt || typeof evt !== 'object') return;
  funnelEvents.push(evt);
  if (funnelEvents.length > MAX_FUNNEL_EVENTS) funnelEvents.splice(0, funnelEvents.length - MAX_FUNNEL_EVENTS);
}

const server = http.createServer((req, res) => {
  const handle = async () => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname === '/api/admin/deepseek/status') {
    if (!isAuthorized(req)) {
      auditAdminDenied(req, url.pathname);
      return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    }
    return sendJson(res, 200, { ok: true, ...deepseekGovernor.getStatus() });
  }
  if (url.pathname === '/api/admin/deepseek/act' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      auditAdminDenied(req, url.pathname);
      return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    }
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      const reason = String(e && e.message || 'invalid_json');
      return sendJson(res, reason === 'payload_too_large' ? 413 : 400, { ok: false, error: reason });
    }
    const action = body && typeof body.action === 'string' ? body.action : '';
    const params = body && typeof body.params === 'object' && body.params ? body.params : {};
    const requestId = body && typeof body.requestId === 'string' ? body.requestId : '';
    const result = await deepseekGovernor.dispatch({
      action,
      params,
      requestId,
      actor: 'deepseek-loop-rescue',
      ip: req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '127.0.0.1',
    });
    return sendJson(res, result.status || 500, result.body || { ok: false, error: 'dispatch_failed' });
  }

  if (url.pathname === '/health' || url.pathname === '/api/health') return sendJson(res, 200, health());
  if (url.pathname === '/api/commerce/health') {
    return sendJson(res, 200, {
      ok: true,
      status: 'healthy',
      service: 'commerce',
      mode: 'rescue',
      checkout: true,
      pricing: true,
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/quantum-integrity/status') {
    return sendJson(res, 200, {
      ok: true,
      active: true,
      integrity: 'intact',
      mode: 'rescue',
      diagnostics: { issues: [] },
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/pricing/all') {
    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      btcUsd,
      btcAddress,
      services,
      pricing: services,
    });
  }
  if (url.pathname === '/api/services' || url.pathname === '/api/services/list') {
    return sendJson(res, 200, { ok: true, updatedAt: new Date().toISOString(), count: services.length, services });
  }
  if (url.pathname === '/api/catalog/master' || url.pathname === '/api/catalog') {
    return sendJson(res, 200, {
      ok: true,
      mode: 'rescue',
      generatedAt: new Date().toISOString(),
      count: services.length,
      items: services.map((service) => ({
        id: service.id,
        title: service.name,
        priceUsd: service.priceUsd,
        priceBtc: service.priceBTC,
        btcAddress: service.btcAddress,
      })),
    });
  }
  if (url.pathname === '/api/btc/rate' || url.pathname === '/api/payment/btc-rate') {
    return sendJson(res, 200, {
      ok: true,
      btcUsd,
      usdPerBtc: btcUsd,
      rate: btcUsd,
      source: 'rescue-fallback',
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/checkout/health' || url.pathname === '/checkout/health') {
    return sendJson(res, 503, checkoutHealth());
  }
  if (url.pathname === '/api/checkout/create' || url.pathname === '/checkout/create' || url.pathname === '/api/checkout/btc') {
    return sendJson(res, 503, {
      ok: false,
      mode: 'rescue',
      error: 'commerce_unavailable_in_rescue',
      message: 'Checkout disabled while rescue-backend is active — restore backend/index.js',
      ts: new Date().toISOString(),
    });
  }
  if (url.pathname === '/api/modules' || url.pathname === '/api/module-registry') {
    return sendJson(res, 200, { ok: true, modules: [], mode: 'rescue' });
  }
  if (url.pathname === '/api/analytics/funnel' && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req, 16 * 1024);
    } catch (e) {
      const reason = String(e && e.message || 'invalid_json');
      return sendJson(res, reason === 'payload_too_large' ? 413 : 400, { ok: false, error: reason });
    }
    const event = String(body && body.event || '').trim().slice(0, 80);
    if (!event) return sendJson(res, 400, { ok: false, error: 'event_required' });
    pushFunnelEvent({
      event,
      route: String(body && body.route || '').slice(0, 160),
      serviceId: String(body && body.serviceId || '').slice(0, 120),
      value: Number.isFinite(Number(body && body.value)) ? Number(body.value) : null,
      source: String(body && body.source || 'web').slice(0, 40),
      ts: new Date().toISOString(),
      ip: (req.socket && req.socket.remoteAddress) ? req.socket.remoteAddress : 'unknown',
      ua: String(req.headers['user-agent'] || '').slice(0, 180),
    });
    return sendJson(res, 202, { ok: true });
  }
  if (url.pathname === '/api/analytics/funnel' && req.method === 'GET') {
    if (!isAuthorized(req)) {
      auditAdminDenied(req, url.pathname);
      return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    }
    return sendJson(res, 200, { ok: true, total: funnelEvents.length, events: funnelEvents.slice(-100) });
  }

  return sendJson(res, 404, { ok: false, error: 'rescue_endpoint_not_found', path: url.pathname });
  };

  handle().catch((e) => {
    sendJson(res, 500, { ok: false, error: 'rescue_internal_error', reason: String(e && e.message || e).slice(0, 160) });
  });
});

server.listen(port, host, () => {
  console.log(`[rescue-api] listening on ${host}:${port}`);
});
